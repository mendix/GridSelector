dojo.provide("GridSelector.widget.GridSelector");
mxui.dom.addCss(dojo.moduleUrl("GridSelector", "widget/ui/GridSelector.css"));
var ___gridselectorsource = {
    templateString: dojo.cache("GridSelector", "widget/ui/GridSelector.html"),

    //inputargs: {
        leftEntity: "",
        leftConstraint: "",
        leftDisplayAttr: "",
        leftSortAttr: "",
        leftSortOrder: "",
        leftWidth: 0,
        topEntity: "",
        topConstraint: "",
        topDisplayAttr: "",
        topSortAttr: "",
        topSortOrder: "",
        onchangemf: "",
        pageLimit: 10,
        readonly: false,
    //},

    // Template attach points
    // controlNode: null,
    // pagingBarNode : null,;
    // pagingPrevious: null,
    // pagingStatusNode: null,
    // pagingNext: null,
    // contentNode : null,;
    // gridHeadNode: null,
    // gridBodyNode: null,

    baseClass: "gridSelector mx-grid",
    subClass: "mx-datagrid",

    // Global Cache
    assoc: null,
    currPage: 0,
    maxPages: 0,
    selected: null,
    rowSelected: null,
    ignoreChange : false,
    rows: [],
    _hasStarted : false,

    // Change log
    // 1 Changed to Mx5 template
    // 2 Set inputs in html form element, multiple radio gridselector can work on one page (Fix)
    // 3 subscitbe to change on the update top header diaplay attribute
    // 4 subscribe to chnage on the left object display attribute
    // 5 able to update before changing the selection (Fix; initalisation of ignoreChange was missing)
    // 6 paging buttond dont show if there are no left objects (Fix)
    // 7 add stylesheet for GridSelector
    // 8 XML: change default sort order to Ascending
    // 9 replace all depricated function with Mx5 functions
    // 10 added error callback on functions that can fail
    // 11 consistant use of double quotes
    // 12 remove harcoded styling from javascript.
    
    /*  Optional TODO's
    - Select all checkboxes on header clock
    - Shift sensitive select rows for adding
    - Tooltip
    - Select with ctrl/shift, keyboard control
    - paging buttons First Last.
        - Use stored cache pages, so changes on page one page is note lost when paging back and forward.
        - Add Empty table text.
    */
       
    startup: function () {
        if (this._hasStarted)
            return;

        this._hasStarted = true;
        this.assoc = this.topEntity.split("/");
        this.inputType = this.checkRefType();
        this.selected = [];
        this.rowSelected = [];

        this.usecontext = this.leftConstraint.indexOf("[%CurrentObject%]") > -1 || this.topConstraint.indexOf("[%CurrentObject%]") > -1;
        if (this.usecontext) {
            this.actLoaded();
        } else {
            mendix.lang.sequence([
                dojo.hitch(this, this.getObjects, 0),
                dojo.hitch(this, this.getTopObjects),
                dojo.hitch(this, this.renderGrid),
                dojo.hitch(this, this.actLoaded)
            ]);
        }
    },

    update: function (obj, callback) {
        if (obj) {
            this.leftConstraint = this.leftConstraint.replace("[%CurrentObject%]", obj.getGuid());
            this.topConstraint = this.topConstraint.replace("[%CurrentObject%]", obj.getGuid());
            mendix.lang.sequence([
                dojo.hitch(this, this.getObjects, 0),
                dojo.hitch(this, this.getTopObjects),
                dojo.hitch(this, this.renderGrid),
                dojo.hitch(this, this.actLoaded)
            ]);
        }
        callback && callback();
    },

    getObjects: function (page, callback) {
        var schema = {
            attributes: [this.leftDisplayAttr],
            sort: [
                [this.leftSortAttr, this.leftSortOrder]
            ],
            offset: page * this.pageLimit,
            limit: this.pageLimit,
            references: {}
        };

        schema.references[this.assoc[0]] = {
            attributes: [this.topDisplayAttr],
            sort: [
                [this.topSortAttr, this.topSortOrder]
            ]
        };

        mx.data.get({
            xpath: "//" + this.leftEntity + this.leftConstraint,
            count: true,
            filter: schema,
            callback: dojo.hitch(this, function (objs, count) {
                this.leftObjs = objs;
                this.setMaxPages(count);
                callback && callback();
            }),
            error: function (err) {
                console.error("Error getObjects //" + this.leftEntity + this.leftConstraint + " : ", err);
            },
            nocache: false
        });
    },

    setMaxPages: function (count) {
        if (typeof count === "number") {
            this.maxPages = this.pageLimit > 0 ? Math.ceil(count / this.pageLimit) - 1 : 1;
        } else {
            this.maxPages = this.pageLimit > 0 ? Math.ceil(count.count / this.pageLimit) - 1 : 1;
        }
    },

    getTopObjects: function (callback) {
        var schema = {};

        schema.attributes = [this.topDisplayAttr];
        schema.sort = [
            [this.topSortAttr, this.topSortOrder]
        ];
        mx.data.get({
            xpath: "//" + this.assoc[1] + this.topConstraint,
            filter: schema,
            callback: dojo.hitch(this, function (objs) {
                this.topObjs = objs;
                for(var i=0; i< objs.length; i++){
                    mx.data.subscribe({
                        guid     : objs[i].getGuid(),
                        callback : dojo.hitch(this, this.updateTopObjects) 
                      });
                }
                callback && callback();
            }),
            error: function (err) {
                console.error("Error getTopObjects //" + this.assoc[1] + this.topConstraint + " : ", err);
            },
            nocache: false
        });
    },
    
    updateTopObjects: function(obj){
        mx.data.get({
            guid     : obj,
            callback : dojo.hitch(this, function(obj) {
               for(var i=0; i< this.topObjs.length; i++)
                    if(obj.getGuid() === this.topObjs[i].getGuid())
                        this.topObjs[i] = obj;
                    this.renderGrid();
            }),
            error: function (err) {
                console.error("Eroor updateTopObjects " + obj + " : ", err);
            }
        });
    },

    renderGrid: function (callback) {
        this.removeSubscriptions();
        this.selected = [];
        this.rows = [];

        dojo.empty(this.gridHeadNode);
        dojo.empty(this.gridBodyNode);

        dojo.html.set(this.pagingStatusNode, (this.currPage + 1) + " out of " + (this.maxPages + 1));
        if (this.currPage === 0) {
            dojo.attr(this.pagingPrevious, "disabled", "disabled");
        } else {
            dojo.removeAttr(this.pagingPrevious, "disabled");
        }
        if (this.currPage === this.maxPages) {
            dojo.attr(this.pagingNext, "disabled", "disabled");
        } else {
            dojo.removeAttr(this.pagingNext, "disabled");
        }

        if (this.maxPages <= 0 ) { 
            dojo.style(this.controlNode, "display", "none");
        } else {
            dojo.style(this.controlNode, "display", "block");
        }

        var tdWidth = null;
        if (this.leftWidth > 0)
            tdWidth = Math.round((100 - this.leftWidth) / (this.topObjs.length));
        else
            tdWidth = Math.round(100 / (this.topObjs.length + 1));

        var headerRow = mxui.dom.tr();
        this.gridHeadNode.appendChild(headerRow);
        headerRow.appendChild(
            mxui.dom.th({
                class: "mx-left-aligned",
                style: "width: " + (this.leftWidth > 0 ? this.leftWidth : tdWidth) + "%"
            }, mxui.dom.div({
                class: "mx-datagrid-head-wrapper"
            }, mxui.dom.div({
                class: "mx-datagrid-head-caption"
            }, " ")))
        );

        for (var k = 0; k < this.topObjs.length; k++) {
            var column = mxui.dom.th({
                    style: "width: " + tdWidth + "%",
                    title: this.topObjs[k].get(this.topDisplayAttr)
                },
                mxui.dom.div({
                    class: "mx-datagrid-head-wrapper"
                }, mxui.dom.div({
                    class: "mx-datagrid-head-caption"
                }, this.topObjs[k].get(this.topDisplayAttr)))
            );
            headerRow.appendChild(column);
        }

        for (var i = 0; i < this.leftObjs.length; i++) {
            var leftAssoc = this.leftObjs[i].get(this.assoc[0]);
            this.rows[i] = {};

            this.subscribe({
                guid: this.leftObjs[i].getGuid(),
                attr: this.assoc[0],
                callback: dojo.hitch(this, this.changeReceived)
            });

            this.subscribe({
                entity: this.leftEntity,
                guid: this.leftObjs[i].getGuid(),
                callback: dojo.hitch(this, this.objRefreshed)
            });

            var nodetd = mxui.dom.td({
                    class: "mx-left-aligned"
                },
                mxui.dom.div({
                    class: "mx-datagrid-data-wrapper"
                }, this.leftObjs[i].get(this.leftDisplayAttr)));
            this.rows[i].header = nodetd;
            this.rows[i].node = mxui.dom.tr({}, nodetd);

            this.gridBodyNode.appendChild(this.rows[i].node);
            this.rows[i].cells = [];

            for (var j = 0; j < this.topObjs.length; j++) {

                var topID = this.topObjs[j].getGuid();
                var checked = leftAssoc !== "" && (leftAssoc.hasOwnProperty(topID) || leftAssoc.guid === topID || topID === leftAssoc);
                this.rows[i].cells[j] = {};

                var cellnode = mxui.dom.td({
                    class: "mx-center-aligned",
                    tabIndex: (i * this.topObjs.length) + j
                });
                this.rows[i].node.appendChild(cellnode);

                if (this.inputType === "checkbox") {
                    // Create checkbox.
                    var checkbox = mxui.dom.input({
                        type: "checkbox"
                    });
                    dojo.attr(checkbox, "defaultChecked", checked);
                    checkbox.checked = checked;
                } else {
                    var checkbox = mxui.dom.input({
                        type: "radio",
                        name: this.leftObjs[i].getGuid()
                    });
                    dojo.attr(checkbox, "defaultChecked", checked);
                    checkbox.checked = checked;
                }
                this.connect(checkbox, "onchange", dojo.hitch(this, this.boxChanged, i, j));
                this.connect(checkbox, "onclick", dojo.hitch(this, this.boxClicked, i, j));
                this.connect(cellnode, "onkeypress", dojo.hitch(this, this.boxKeyPress, i, j));

                if (this.readonly === true)
                    dojo.attr(checkbox, "disabled", true);

                cellnode.appendChild(mxui.dom.div({
                    class: "mx-datagrid-data-wrapper"
                }, checkbox));

                this.rows[i].cells[j] = {
                    box: checkbox,
                    left: this.leftObjs[i],
                    top: this.topObjs[j],
                    node: cellnode,
                    row: i,
                    col: j
                };
            }
        }
        callback && callback();
    },

    eventPagingPreviousClicked: function (e) {
        this.loadPage(-1);
    },

    eventPagingNextClicked: function (e) {
        this.loadPage(+1);
    },

    loadPage: function (page, e) {
        this.currPage += page;
        if (this.currPage < 0) {
            this.currPage = 0;
            return;
        } else if (this.currPage > this.maxPages) {
            this.currPage = this.maxPages;
            return;
        }
        this.getObjects(this.currPage, dojo.hitch(this, this.renderGrid));
    },

    selectCell: function (i, j) {
        var cell = this.rows[i].cells[j];
        var selectIdx = this.arrIndexOf(this.selected, cell);
        this.setSelectedCell(cell, !(selectIdx > -1));
    },

    setSelectedCell: function (cell, selected) {
        if (selected) {
            dojo.addClass(cell.node, "cellSelected");
            this.selected.push(cell);
        } else {
            dojo.removeClass(cell.node, "cellSelected");
            this.selected.splice(this.arrIndexOf(this.selected, cell), 1);
        }
    },

    boxKeyPress: function (row, col, evt) {
        var selectNode;
        if (evt.charCode === 32 && this.rows[row] && this.rows[row].cells[col]) {
            var checkbox = this.rows[row].cells[col];
            checkbox.box.checked = !checkbox.box.checked;
            this.boxChanged(row, col);
            evt && dojo.stopEvent(evt);
        } else {
            switch (evt.keyCode) {
            case 37:
                // Left arrow
                if (col > 0) {
                    selectNode = this.rows[row].cells[col - 1];
                }
                evt && dojo.stopEvent(evt);
                break;
            case 38:
                // Up arrow
                if (row > 0) {
                    var rowExists = this.rows[row - 1];
                    if (rowExists)
                        selectNode = rowExists.cells[col];
                }
                evt && dojo.stopEvent(evt);
                break;
            case 39:
                // Right arrow
                selectNode = this.rows[row].cells[col + 1];
                evt && dojo.stopEvent(evt);
                break;
            case 40:
                // Down arrow
                var nextRow = this.rows[row + 1];
                if (nextRow) {
                    selectNode = nextRow.cells[col];
                }
                evt && dojo.stopEvent(evt);
                break;
            }
            if (selectNode && selectNode.node) {
                selectNode.node.focus();
            }
        }
    },

    boxClicked: function (i, j, evt) {
        this.rows[i].cells[j].node.focus();
        // This is so checking the box doesnt get interpreted as clicking the container node as well
        evt && evt.stopPropagation();
    },

    boxChanged: function (i, j, evt) {
        this.ignoreChange = true;
        try {
            var cell = this.rows[i].cells[j];
            this.getLeftRefs(cell.left.getGuid(), dojo.hitch(this, function (refs) {
                if (cell.box.checked) {
                    if (this.inputType === "checkbox") {
                        refs.push(cell.top.getGuid());

                        cell.left.setAttribute(this.assoc[0], refs);
                    } else {
                        cell.left.setAttribute(this.assoc[0], cell.top.getGuid());
                    }

                } else {
                    if (this.inputType === "checkbox") {
                        var filterrefs = dojo.filter(refs, function (item) {
                            return item !== cell.top.getGuid();
                        });

                        cell.left.setAttribute(this.assoc[0], filterrefs);
                    } else {
                        cell.left.setAttribute(this.assoc[0], "");
                    }
                }
                this.execclick(cell.left);
            }));
        } finally {
            this.ignoreChange = false;
        }
    },

    changeReceived: function (guid, attr, value) {
        // guid = contextguid
        // attr = association
        // value = all the new guids in the assoc [] or string when type = ref

        // TODO: Is triggered with this.boxChanged. Prevent this? Should not change anything but is needless (and pins).
        // TODO: Setting this breaks the changing of multiple checkboxes, where the 3th checkbox change coincides with the changereceived from the first etc.

        if (!this.ignoreChange) {
            var idx = this.objIndexOf(this.leftObjs, guid);

            if (idx > -1) {
                var left = this.leftObjs[idx];
                var cells = this.rows[idx].cells;
                for (var i = 0; i < cells.length; i++) {
                    if (value instanceof Array) {
                        if (this.arrIndexOf(value, cells[i].top.getGuid()) > -1)
                            cells[i].box.checked = true;
                        else
                            cells[i].box.checked = false;
                    } else {
                        if (value === cells[i].top.getGuid())
                            cells[i].box.checked = true;
                        else
                            cells[i].box.checked = false;
                    }
                }
            }
        }
    },

    objRefreshed: function (guid) {
        var idx = this.objIndexOf(this.leftObjs, guid),
            left = this.leftObjs[idx],
            cells = this.rows[idx].cells,
            header = this.rows[idx].header;    

        if (!this.ignoreChange) {
            function setBoxes(refs, obj) {
                for (var i = 0; i < cells.length; i++) {
                    if (refs instanceof Array) {
                        if (this.arrIndexOf(refs, cells[i].top.getGuid()) > -1)
                            cells[i].box.checked = true;
                        else
                            cells[i].box.checked = false;
                    } else {
                        if (refs === cells[i].top.getGuid())
                            cells[i].box.checked = true;
                        else
                            cells[i].box.checked = false;
                    }
                }
                // update local cache
                for(var i=0; i< this.leftObjs.length; i++){
                    if(this.leftObjs[i].getGuid() === obj.getGuid()){
                        this.leftObjs[i] = obj;
                        break;
                    }
                }
                dojo.html.set(header, obj.get(this.leftDisplayAttr));
            };

            this.getLeftRefs(left, dojo.hitch(this, setBoxes));
        }
    },

    getLeftRefs: function (leftid, callback) {
        var filter = {
            attributes: [this.leftDisplayAttr],
            sort: [
                [this.leftSortAttr, this.leftSortOrder]
            ],
            offset: 0,
            limit: this.pageLimit,
            references: {}
        };

        filter.references[this.assoc[0]] = {
            attributes: [this.topDisplayAttr],
            sort: [
                [this.topSortAttr, this.topSortOrder]
            ]
        };

        mx.data.get({
            guid: leftid,
            filter: filter,
            callback: dojo.hitch(this, function (obj) {
                var refs = obj.get(this.assoc[0]);
                refs = (refs === "") ? [] : refs;
                callback && callback(refs, obj);
            }),
            error: function (err) {
                    console.error("Error in getLeftRefs " + leftid + " : " + err);
                }
        });
    },

    checkRefType: function () {
        var split = this.topEntity.split("/");
        var entity = mx.meta.getEntity(this.leftEntity);
        if (entity.isObjectReference(split[0]))
            return "radio";
        else
            return "checkbox";
    },

    execclick: function (mxobj) {
        if (this.onchangemf !== "" && mxobj) {
            mx.data.action({
                params: {
                    actionname: this.onchangemf,
                    applyto: 'selection',
                    guids : [mxobj.getGuid()]
                },
                callback: function () {
                    // ok   
                },
                error: function (err) {
                    console.error("exec click returned error for guid " + mxobj.getGuid() + " MF:" + this.onchangemf + " : ", err);
                }
            });
        }
    },

    objIndexOf: function (self, guidStr) {
        for (var i = 0; i < self.length; i++) {
            if (self[i].getGuid() === guidStr) {
                return i;
            }
        }
        return -1;
    },

    arrIndexOf: function (self, obj) {
        if (!(self instanceof Array) || self.length === 0)
            return -1;

        for (var i = 0; i < self.length; i++) {
            if (self[i] === obj) {
                return i;
            }
        }
        return -1;
    },

    uninitialize: function () {}
};
dojo.declare("GridSelector.widget.GridSelector", [mxui.widget._WidgetBase, dijit._TemplatedMixin, mxui.widget._Widget] , ___gridselectorsource);
dojo.declare("GridSelector.widget.CheckboxGrid",[mxui.widget._WidgetBase, dijit._TemplatedMixin, mxui.widget._Widget], ___gridselectorsource);
dojo.declare("GridSelector.widget.RadioGrid",[mxui.widget._WidgetBase, dijit._TemplatedMixin, mxui.widget._Widget], ___gridselectorsource);
delete ___gridselectorsource;