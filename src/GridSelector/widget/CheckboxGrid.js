require([
    "dojo/_base/declare",
    "GridSelector/widget/GridSelector",
    "dojo/text!GridSelector/widget/template/GridSelector.html"
], function (declare, _GridSelector, widgetTemplate) {
    "use strict";

    return declare("GridSelector.widget.CheckboxGrid", [ _GridSelector ], {

        templateString: widgetTemplate,

        _checkRefType: function () {
            return "checkbox";
        }
    });
});

require(["GridSelector/widget/CheckboxGrid"]);
