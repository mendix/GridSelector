/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console, mendix, lang, mxui, event */
/*mendix */
/*
    GridSelector
    ========================

    @file      : GridSelector.js
    @version   : 2.0
    @author    : Gerhard Richard Edens
    @date      : Mon, 20 Apr 2015 09:49:50 GMT
    @copyright : Mendix B.v.
    @license   : Apache 2

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define( [
    'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/dom-attr', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text', 'dojo/html', 'dojo/_base/event'
], function (declare, _WidgetBase, _TemplatedMixin,
              dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, domAttr, dojoArray, lang, text, html, dojoEvent) {
    'use strict';

    // Declare widget's prototype.
    return declare('GridSelector.widget.GridSelector', [ _WidgetBase, _TemplatedMixin ], {

        // Variables
        baseClass: 'gridSelector mx-grid',
        subClass: 'mx-datagrid',

        // Global Cache
        _assoc: null,
        _currPage: null,
        _maxPages: null,
        _selected: null,
        _rowSelected: null,
        _ignoreChange : null,
        _rows: null,
        _hasStarted : null,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handle: null,
        _contextObj: null,
        _objProperty: null,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            this._objProperty = {};
            this._assoc = null;
            this._currPage = 0;
            this._maxPages = 0;
            this._selected = null;
            this._rowSelected = null;
            this._ignoreChange = false;
            this._rows = [];
            this._hasStarted = false;
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },

        startup: function () {
            if (this._hasStarted) {
                return;
            }
            this._hasStarted = true;
            this._assoc = this.topEntity.split('/');
            this.inputType = this._checkRefType();
            this._selected = [];
            this._rowSelected = [];

            this.usecontext = this.leftConstraint.indexOf('[%CurrentObject%]') > -1 || this.topConstraint.indexOf('[%CurrentObject%]') > -1;
            if (this.usecontext) {
                this.actLoaded();
            } else {
                mendix.lang.sequence([
                    lang.hitch(this, this._getObjects, 0),
                    lang.hitch(this, this._getTopObjects),
                    lang.hitch(this, this._renderGrid),
                    lang.hitch(this, this.actLoaded)
                ]);
            }
        },

        update: function (obj, callback) {
            if (obj) {
                this.leftConstraint = this.leftConstraint.replace('[%CurrentObject%]', obj.getGuid());
                this.topConstraint = this.topConstraint.replace('[%CurrentObject%]', obj.getGuid());
                mendix.lang.sequence([
                    lang.hitch(this, this._getObjects, 0),
                    lang.hitch(this, this._getTopObjects),
                    lang.hitch(this, this._renderGrid),
                    lang.hitch(this, this.actLoaded)
                ]);
            }
            callback();
        },

        _getObjects: function (page, callback) {
            var schema = {
                attributes: [this.leftDisplayAttr],
                sort: [
                    [this.leftSortAttr, this.leftSortOrder]
                ],
                offset: page * this.pageLimit,
                limit: this.pageLimit,
                references: {}
            };

            schema.references[this._assoc[0]] = {
                attributes: [this.topDisplayAttr],
                sort: [
                    [this.topSortAttr, this.topSortOrder]
                ]
            };

            mx.data.get({
                xpath: '//' + this.leftEntity + this.leftConstraint,
                count: true,
                filter: schema,
                callback: lang.hitch(this, function (objs, count) {
                    this._leftObjs = objs;
                    this._setMaxPages(count);
                    callback();
                }),
                error: function (err) {
                    console.error('Error _getObjects //' + this.leftEntity + this.leftConstraint + ' : ', err);
                },
                nocache: false
            });
        },

        _setMaxPages: function (count) {
            if (typeof count === 'number') {
                this._maxPages = this.pageLimit > 0 ? Math.ceil(count / this.pageLimit) - 1 : 1;
            } else {
                this._maxPages = this.pageLimit > 0 ? Math.ceil(count.count / this.pageLimit) - 1 : 1;
            }
        },

        _getTopObjects: function (callback) {
            var schema = {};

            schema.attributes = [this.topDisplayAttr];

            schema.sort = [
                [this.topSortAttr, this.topSortOrder]
            ];

            mx.data.get({
                xpath: '//' + this._assoc[1] + this.topConstraint,
                filter: schema,
                callback: lang.hitch(this, function (objs) {
                    var i = null;
                    this.topObjs = objs;
                    for(i = 0; i< objs.length; i++){
                        mx.data.subscribe({
                            guid     : objs[i].getGuid(),
                            callback : lang.hitch(this, this._updateTopObjects)
                        });
                    }
                    callback();
                }),
                error: function (err) {
                    console.error('Error getTopObjects //' + this._assoc[1] + this.topConstraint + ' : ', err);
                },
                nocache: false
            });
        },

        _updateTopObjects: function(obj){
            mx.data.get({
                guid     : obj,
                callback : lang.hitch(this, function(obj) {
                    var i = null;
                    for(i = 0; i< this.topObjs.length; i++) {
                        if (obj.getGuid() === this.topObjs[i].getGuid()) {
                            this.topObjs[i] = obj;
                        }
                    }
                    this._renderGrid();
                }),
                error: function (err) {
                    console.error('Error updateTopObjects ' + obj + ' : ', err);
                }
            });
        },

        _renderGrid: function (callback) {
            this._selected = [];
            this._rows = [];

            var _tdWidth = null,
                _headerRow = null,
                _column = null,
                _leftAssoc = null,
                _nodetd = null,
                _topID = null,
                _checked = null,
                _cellnode = null,
                _checkbox = null,
                k = null,
                i = null,
                j = null;

            domConstruct.empty(this.gridHeadNode);
            domConstruct.empty(this.gridBodyNode);

            html.set(this.pagingStatusNode, (this._currPage + 1) + ' out of ' + (this._maxPages + 1));

            if (this._currPage === 0) {
                domAttr.set(this.pagingPrevious, 'disabled', 'disabled');
            } else {
                domAttr.remove(this.pagingPrevious, 'disabled');
            }

            if (this._currPage === this._maxPages) {
                domAttr.set(this.pagingNext, 'disabled', 'disabled');
            } else {
                domAttr.remove(this.pagingNext, 'disabled');
            }

            if (this._maxPages <= 0 ) {
                domStyle.set(this.controlNode, 'display', 'none');
            } else {
                domStyle.set(this.controlNode, 'display', 'block');
            }

            if (this.leftWidth > 0) {
                _tdWidth = Math.round((100 - this.leftWidth) / (this.topObjs.length));
            } else {
                _tdWidth = Math.round(100 / (this.topObjs.length + 1));
            }

            _headerRow = mxui.dom.tr();
            this.gridHeadNode.appendChild(_headerRow);

            _headerRow.appendChild(
                mxui.dom.th({
                    'class': 'mx-left-aligned',
                    'style': 'width: ' + (this.leftWidth > 0 ? this.leftWidth : _tdWidth) + '%'
                }, mxui.dom.div({
                    'class': 'mx-datagrid-head-wrapper'
                }, mxui.dom.div({
                    'class': 'mx-datagrid-head-caption'
                }, ' ')))
            );

            for (k = 0; k < this.topObjs.length; k++) {
                _column = mxui.dom.th({
                    'style': 'width: ' + _tdWidth + '%',
                    'title': this.topObjs[k].get(this.topDisplayAttr)
                }, mxui.dom.div({
                    'class': 'mx-datagrid-head-wrapper'
                }, mxui.dom.div({
                    'class': 'mx-datagrid-head-caption'
                }, this.topObjs[k].get(this.topDisplayAttr))));
                _headerRow.appendChild(_column);
            }

            for (i = 0; i < this._leftObjs.length; i++) {
                _leftAssoc = this._leftObjs[i].get(this._assoc[0]);
                this._rows[i] = {};

                this.subscribe({
                    guid: this._leftObjs[i].getGuid(),
                    attr: this._assoc[0],
                    callback: lang.hitch(this, this._changeReceived)
                });

                this.subscribe({
                    entity: this.leftEntity,
                    guid: this._leftObjs[i].getGuid(),
                    callback: lang.hitch(this, this._objRefreshed)
                });

                _nodetd = mxui.dom.td(
                    {
                        'class': 'mx-left-aligned'
                    },
                    mxui.dom.div(this._leftObjs[i].get(this.leftDisplayAttr))
                );

                this._rows[i].header = _nodetd;
                this._rows[i].node = mxui.dom.tr({}, _nodetd);

                this.gridBodyNode.appendChild(this._rows[i].node);
                this._rows[i].cells = [];

                for (j = 0; j < this.topObjs.length; j++) {

                    _topID = this.topObjs[j].getGuid();
                    _checked = _leftAssoc !== '' && (_leftAssoc.hasOwnProperty(_topID) || _leftAssoc.guid === _topID || _topID === _leftAssoc);

                    this._rows[i].cells[j] = {};

                    _cellnode = mxui.dom.td({
                        'class': 'mx-center-aligned',
                        'tabIndex': (i * this.topObjs.length) + j
                    });

                    this._rows[i].node.appendChild(_cellnode);

                    if (this.inputType === 'checkbox') {
                        // Create checkbox.
                        _checkbox = mxui.dom.input({
                            'type': 'checkbox',
                            'name': this._leftObjs[i].getGuid()
                        });
                        domAttr.set(_checkbox, 'defaultChecked', _checked);
                        _checkbox.checked = _checked;
                    } else {
                        _checkbox = mxui.dom.input({
                            'type': 'radio',
                            'name': this._leftObjs[i].getGuid()
                        });
                        domAttr.set(_checkbox, 'defaultChecked', _checked);
                        _checkbox.checked = _checked;
                    }
                    this.connect(_checkbox, 'onchange', lang.hitch(this, this._boxChanged, i, j));
                    this.connect(_cellnode, 'onkeypress', lang.hitch(this, this._boxKeyPress, i, j));

                    if (this.readonly === true) {
                        domAttr.set(_checkbox, 'disabled', true);
                    }

                    _cellnode.appendChild(mxui.dom.div({
                        'class': 'mx-datagrid-data-wrapper'
                    }, _checkbox));

                    this._rows[i].cells[j] = {
                        'box': _checkbox,
                        'left': this._leftObjs[i],
                        'top': this.topObjs[j],
                        'node': _cellnode,
                        'row': i,
                        'col': j
                    };
                }
            }
            callback();
        },

        eventPagingPreviousClicked: function (e) {
            this._loadPage(-1);
        },

        eventPagingNextClicked: function (e) {
            this._loadPage(+1);
        },

        _loadPage: function (page, e) {
            this._currPage += page;
            if (this._currPage < 0) {
                this._currPage = 0;
                return;
            } else if (this._currPage > this._maxPages) {
                this._currPage = this._maxPages;
                return;
            }
            this._getObjects(this._currPage, lang.hitch(this, this._renderGrid));
        },

        selectCell: function (i, j) {
            var _cell = null,
                _selectIdx = null;
            _cell = this._rows[i].cells[j];
            _selectIdx = this._arrIndexOf(this._selected, _cell);
            this._setSelectedCell(_cell, ((_selectIdx > -1) === 0));
        },

        _setSelectedCell: function (_cell, _selected) {
            if (_selected) {
                domClass.add(_cell.node, 'cellSelected');
                this._selected.push(_cell);
            } else {
                domClass.remove(_cell.node, 'cellSelected');
                this._selected.splice(this._arrIndexOf(this._selected, _cell), 1);
            }
        },

        _boxKeyPress: function (_row, _col, _evt) {
            var _selectNode = null,
                _checkbox = null,
                _rowExists = null,
                _nextRow = null;
            if (_evt.charCode === 32 && this._rows[_row] && this._rows[_row].cells[_col]) {
                _checkbox = this._rows[_row].cells[_col];
                _checkbox.box.checked = !_checkbox.box.checked;
                this._boxChanged(_row, _col);
                dojoEvent.stop(_evt);
            } else {
                switch (_evt.keyCode) {
                    case 37:
                        // Left arrow
                        if (_col > 0) {
                            _selectNode = this._rows[_row].cells[_col - 1];
                        }
                        dojoEvent.stop(_evt);
                        break;
                    case 38:
                        // Up arrow
                        if (_row > 0) {
                            _rowExists = this._rows[_row - 1];
                            if (_rowExists) {
                                _selectNode = _rowExists.cells[_col];
                            }
                        }
                        dojoEvent.stop(_evt);
                        break;
                    case 39:
                        // Right arrow
                        _selectNode = this._rows[_row].cells[_col + 1];
                        dojoEvent.stop(_evt);
                        break;
                    case 40:
                        // Down arrow
                        _nextRow = this._rows[_row + 1];
                        if (_nextRow) {
                            _selectNode = _nextRow.cells[_col];
                        }
                        dojoEvent.stop(_evt);
                        break;
                }
                if (_selectNode && _selectNode.node) {
                    _selectNode.node.focus();
                }
            }
        },

        _boxClicked: function (i, j, _evt) {
            this._rows[i].cells[j].node.focus();
            // This is so checking the box doesnt get interpreted as clicking the container node as well
            dojoEvent.stop(_evt);
        },

        _boxChanged: function (i, j, _evt) {
            var _cell = null,
                _filterrefs = null;

            this._ignoreChange = true;

            try {
                _cell = this._rows[i].cells[j];
                this._getLeftRefs(_cell.left.getGuid(), lang.hitch(this, function (_refs) {
                    if (_cell.box.checked) {
                        if (this.inputType === 'checkbox') {
                            _refs.push(_cell.top.getGuid());

                            _cell.left.set(this._assoc[0], _refs);
                        } else {
                            _cell.left.set(this._assoc[0], _cell.top.getGuid());
                        }
                    } else {
                        if (this.inputType === 'checkbox') {
                            _filterrefs = dojoArray.filter(_refs, function (item) {
                                return item !== _cell.top.getGuid();
                            });

                            _cell.left.set(this._assoc[0], _filterrefs);
                        } else {
                            _cell.left.set(this._assoc[0], '');
                        }
                    }
                    this._executeClick(_cell.left);
                }));
            } finally {
                this._ignoreChange = false;
            }
        },

        _changeReceived: function (_guid, _attr, _value) {
            var _idx = null,
                _left = null,
                _cells = null,
                i = 0;

            // guid = contextguid
            // attr = association
            // value = all the new guids in the assoc [] or string when type = ref

            // TODO: Is triggered with this._boxChanged. Prevent this? Should not change anything but is needless (and pins).
            // TODO: Setting this breaks the changing of multiple checkboxes, where the 3th checkbox change coincides with the changereceived from the first etc.

            if (!this._ignoreChange) {
                _idx = this._objIndexOf(this._leftObjs, _guid);

                if (_idx > -1) {
                    _left = this._leftObjs[_idx];
                    _cells = this._rows[_idx].cells;
                    for (i = 0; i < _cells.length; i++) {
                        if (_value instanceof Array) {
                            if (this._arrIndexOf(_value, _cells[i].top.getGuid()) > -1) {
                                _cells[i].box.checked = true;
                            } else {
                                _cells[i].box.checked = false;
                            }
                        } else {
                            if (_value === _cells[i].top.getGuid()) {
                                _cells[i].box.checked = true;
                            } else {
                                _cells[i].box.checked = false;
                            }
                        }
                    }
                }
            }
        },

        _objRefreshed: function (_guid) {
            var _idx = this._objIndexOf(this._leftObjs, _guid),
                _left = this._leftObjs[_idx],
                _cells = this._rows[_idx].cells,
                _header = this._rows[_idx].header,
                i = 0;

            function _setBoxes(_refs, _obj) {
                for (i = 0; i < _cells.length; i++) {
                    if (_refs instanceof Array) {
                        if (this._arrIndexOf(_refs, _cells[i].top.getGuid()) > -1) {
                            _cells[i].box.checked = true;
                        } else {
                            _cells[i].box.checked = false;
                        }
                    } else {
                        if (_refs === _cells[i].top.getGuid()) {
                            _cells[i].box.checked = true;
                        } else {
                            _cells[i].box.checked = false;
                        }
                    }
                }

                // update local cache
                for(i = 0; i < this._leftObjs.length; i++){
                    if(this._leftObjs[i].getGuid() === _obj.getGuid()){
                        this._leftObjs[i] = _obj;
                        break;
                    }
                }

                html.set(_header, _obj.get(this.leftDisplayAttr));
            };

            if (!this._ignoreChange) {
                this._getLeftRefs(_left, lang.hitch(this, _setBoxes));
            }
        },

        _getLeftRefs: function (_leftid, callback) {
            var _filter = {
                attributes: [this.leftDisplayAttr],
                sort: [
                    [this.leftSortAttr, this.leftSortOrder]
                ],
                offset: 0,
                limit: this.pageLimit,
                references: {}
            };

            _filter.references[this._assoc[0]] = {
                attributes: [this.topDisplayAttr],
                sort: [
                    [this.topSortAttr, this.topSortOrder]
                ]
            };

            mx.data.get({
                guid: _leftid,
                filter: _filter,
                callback: lang.hitch(this, function (obj) {
                    var refs = obj.get(this._assoc[0]);
                    refs = (refs === '') ? [] : refs;
                    callback(refs, obj);
                }),
                error: function (err) {
                    console.error('Error in getLeftRefs ' + _leftid + ' : ' + err);
                }
            });
        },

        _checkRefType: function () {
            return 'checkbox';
        },

        _executeClick: function (_mxobj) {
            if (this.onchangemf !== '' && _mxobj) {
                mx.data.action({
                    params: {
                        actionname: this.onchangemf,
                        applyto: 'selection',
                        guids : [_mxobj.getGuid()]
                    },
                    callback: function () {
                        // ok
                    },
                    error: function (err) {
                        console.error('exec click returned error for guid ' + _mxobj.getGuid() + ' MF:' + this.onchangemf + ' : ', err);
                    }
                });
            }
        },

        _objIndexOf: function (_self, _guidStr) {
            var i = null;
            for (i = 0; i < _self.length; i++) {
                if (_self[i].getGuid() === _guidStr) {
                    return i;
                }
            }
            return -1;
        },

        _arrIndexOf: function (_self, _obj) {
            var i = null;
            if (!(_self instanceof Array) || _self.length === 0) {
                return -1;
            }
            for (i = 0; i < _self.length; i++) {
                if (_self[i] === _obj) {
                    return i;
                }
            }
            return -1;
        }
    });
});
