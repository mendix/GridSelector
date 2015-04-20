/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console */
/*mendix */
/*
    GridSelector
    ========================

    @file      : RadioGrid.js
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
require({
    packages: [{ name: 'jquery', location: '../../widgets/GridSelector/lib', main: 'jquery-1.11.2.min' }]
}, [
    'dojo/_base/declare', 'GridSelector/widget/GridSelector',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text',
    'jquery', 'dojo/text!GridSelector/widget/template/GridSelector.html'
], function (declare, _GridSelector, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text, $, widgetTemplate) {
    'use strict';
    
    // Declare widget's prototype.
    return declare('GridSelector.widget.RadioGrid', [ _GridSelector ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,
    
        _checkRefType: function () {
            return 'radio';
        }

    });
});
