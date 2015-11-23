/**
 * Published under the MIT license.
 * See https://github.com/cgastrell/gxp_spatialselector/raw/master/LICENSE for the full text
 * of the license.
 * Feel free to download/copy/contribute and distribute. Pay it forward.
 */

/** All these copied from the plugin I forked from, didn't check.
 * @requires plugins/Tool.js
 * @requires OpenLayers/StyleMap.js
 * @requires OpenLayers/Rule.js
 * @requires OpenLayers/Control/Measure.js
 * @requires OpenLayers/Layer/Vector.js
 * @requires OpenLayers/Handler/Path.js
 * @requires OpenLayers/Handler/Polygon.js
 * @requires OpenLayers/Renderer/SVG.js
 * @requires OpenLayers/Renderer/VML.js
 * @requires OpenLayers/Renderer/Canvas.js
 */

/** api: (define)
 *  module = gxp.plugins
 *  class = SpatialSelector
 */

/** api: (extends)
 *  plugins/Tool.js
 */
Ext.namespace("gxp.plugins");

/** api: constructor
 *  .. class:: SpatialSelector(config)
 *
 *  Provides two actions for making a spatial request (buffer and polygon).
 */
gxp.plugins.SpatialSelector = Ext.extend(gxp.plugins.Tool, {
  
  /** api: ptype = gxp_spatialselector */
  ptype: "gxp_spatialselector",

  /** api: config[outputTarget]
   *  ``String`` Popups created by this tool are added to the map by default.
   */
  outputTarget: "map",

  /** api: config[buttonText]
   *  ``String``
   *  Text for the Spatial Selector button (i18n).
   */
  buttonText: "Select...",

  /** api: config[lengthMenuText]
   *  ``String``
   *  Text for buffer menu item.
   */
  bufferMenuText: "by Buffer",

  /** api: config[areaMenuText]
   *  ``String``
   *  Text for polygon select menu item.
   */
  polygonMenuText: "by Polygon",

  /**
   * api: config[symbolizers]
   * ``Object``
   * Symbolizer object for Polygon
   */
  polygonSymbolizer: {
    strokeWidth: 2,
    strokeOpacity: 1,
    strokeColor: "#666666",
    fillColor: "white",
    fillOpacity: 0.3,
    strokeDashstyle: "dash"
  },


  /** api: config[selectTooltip]
   *  ``String``
   *  Text for select action tooltip.
   */
  selectTooltip: "Select features",

  bufferCallback: function(evt) {
    console.log(evt);
  },

  polygonCallback: function(evt) {
    console.log(evt);
  },

  /** private: method[constructor]
   */
  constructor: function(config) {
    gxp.plugins.SpatialSelector.superclass.constructor.apply(this, arguments);
  },

  /** private: method[destroy]
   */
  destroy: function() {
    this.button = null;
    gxp.plugins.SpatialSelector.superclass.destroy.apply(this, arguments);
  },

  /** private: method[createSelectorControl]
   * :param: handlerType: the :class:`OpenLayers.Handler` for the measurement
   *     operation
   * :param: title: the string label to display alongside results
   *
   * Convenience method for creating a :class:`OpenLayers.Control.Measure`
   * control
   */
  createSelectorControl: function(selectorType, title) {

    //dunno, remove?
    var styleMap2 = new OpenLayers.StyleMap({
      "default": new OpenLayers.Style(null, {
        rules: [new OpenLayers.Rule({
          symbolizer: {
            "Point": {
              pointRadius: 4,
              graphicName: "square",
              fillColor: "white",
              fillOpacity: 1,
              strokeWidth: 1,
              strokeOpacity: 1,
              strokeColor: "#333333"
            },
            "Line": {
              strokeWidth: 3,
              strokeOpacity: 1,
              strokeColor: "#666666",
              strokeDashstyle: "dash"
            },
            "Polygon": {
              strokeWidth: 2,
              strokeOpacity: 1,
              strokeColor: "#666666",
              fillColor: "white",
              fillOpacity: 0.3
            }
          }
        })]
      })
    });

    this.polygonSymbolizer = Ext.apply(
      {"Polygon": this.polygonSymbolizer},
      {"Polygon": this.initialConfig.polygonSymbolizer}
    );

    // create default styleMap
    var styleMap = new OpenLayers.StyleMap({
      "default": new OpenLayers.Style(null, {
        rules: [new OpenLayers.Rule({symbolizer: this.polygonSymbolizer})]
      })
    });


    // create layer to draw the buffer
    var layer = new OpenLayers.Layer.Vector("spatialSelector", {
      styleMap: styleMap
    });


    var controlOptions = Ext.apply({}, this.initialConfig.controlOptions,{
      bufferCallback: this.bufferCallback,
      polygonCallback: this.polygonCallback
    });

    var control;
    var polyOptions;

    if(selectorType == "buffer") {
      //case Buffer
      polyOptions = {
        handlerOptions: {
          sides: 40,
          freehand: true,
          style: {
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeColor: "#666666",
            fillColor: "blue",
            fillOpacity: 0.3,
            strokeDashstyle: "dash"
          }
        }
      };
      
      control = new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.RegularPolygon, polyOptions);
      control.events.register('buffer', control, controlOptions.bufferCallback);

      layer.events.register("featureadded", control, function(evt) {

        var center = evt.feature.geometry.getCentroid();
        var bounds = evt.feature.geometry.getBounds();
        var vertices = evt.feature.geometry.getVertices();

        // since we're drawing a circle, any vertex should have the same
        // distance to the center
        var distance = center.distanceTo(vertices[0]);
        this.events.triggerEvent("buffer", {
          center : center,
          distance: distance,
          feature: evt.feature
        });


      });
    }else if(selectorType == "polygon") {
      //case Poly
      polyOptions = {
        handlerOptions: {
          style: {
            strokeWidth: 2,
            strokeOpacity: 1,
            strokeColor: "#666666",
            fillColor: "blue",
            fillOpacity: 0.3,
            strokeDashstyle: "dash"
          }
        }
      };
      control = new OpenLayers.Control.DrawFeature(layer, OpenLayers.Handler.Polygon, polyOptions);
      
      control.events.register('aoi', control, controlOptions.polygonCallback);

      layer.events.register("featureadded", control, function(evt) {

        this.events.triggerEvent("aoi", {polygon:evt.feature});
      });
    }

    control.handlerOptions = control.handlerOptions || {};
    control.handlerOptions.layerOptions = OpenLayers.Util.applyDefaults(
      control.handlerOptions.layerOptions, {
        renderers: layer.renderers,
        rendererOptions: layer.rendererOptions
      }
    );

    return control;
  },

  /** api: method[addActions]
   */
  addActions: function() {
    this.activeIndex = 0;
    this.button = new Ext.SplitButton({
      iconCls: "gxp-icon-select-buffer",
      tooltip: this.selectTooltip,
      buttonText: this.buttonText,
      enableToggle: true,
      toggleGroup: this.toggleGroup,
      allowDepress: true,
      handler: function(button, event) {
        if(button.pressed) {
          button.menu.items.itemAt(this.activeIndex).setChecked(true);
        }
      },
      scope: this,
      listeners: {
        toggle: function(button, pressed) {
          // toggleGroup should handle this
          if(!pressed) {
            button.menu.items.each(function(i) {
              i.setChecked(false);
            });
          }
        },
        render: function(button) {
          // toggleGroup should handle this
          Ext.ButtonToggleMgr.register(button);
        }
      },
      menu: new Ext.menu.Menu({
        items: [
          new Ext.menu.CheckItem(
            new GeoExt.Action({
              text: this.bufferMenuText,
              iconCls: "gxp-icon-select-buffer",
              toggleGroup: this.toggleGroup,
              group: this.toggleGroup,
              listeners: {
                checkchange: function(item, checked) {
                  this.activeIndex = 0;
                  this.button.toggle(checked);
                  if (checked) {
                    this.button.setIconClass(item.iconCls);
                  }
                },
                scope: this
              },
              map: this.target.mapPanel.map,
              control: this.createSelectorControl("buffer", this.bufferTooltip )
            })
          ),
          new Ext.menu.CheckItem(
            new GeoExt.Action({
              text: this.polygonMenuText,
              iconCls: "gxp-icon-select-polygon",
              toggleGroup: this.toggleGroup,
              group: this.toggleGroup,
              allowDepress: false,
              listeners: {
                checkchange: function(item, checked) {
                  this.activeIndex = 1;
                  this.button.toggle(checked);
                  if (checked) {
                    this.button.setIconClass(item.iconCls);
                  }
                },
                scope: this
              },
              map: this.target.mapPanel.map,
              control: this.createSelectorControl("polygon", this.polygonTooltip )
            })
          )
        ]
      })
    });

    return gxp.plugins.SpatialSelector.superclass.addActions.apply(this, [this.button]);
  }
    
});

Ext.preg(gxp.plugins.SpatialSelector.prototype.ptype, gxp.plugins.SpatialSelector);
