require([
    "dojo/_base/declare",
    "GridSelector/widget/GridSelector",
    "dojo/text!GridSelector/widget/template/GridSelector.html"
], function (declare, _GridSelector, widgetTemplate) {
    "use strict";

    return declare("GridSelector.widget.RadioGrid", [ _GridSelector ], {

        templateString: widgetTemplate,

        _checkRefType: function () {
            return "radio";
        }
    });
});

require(["GridSelector/widget/RadioGrid"]);
