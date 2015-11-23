# gxp_spatialselector
Gxp high level plugin/widget for buffer and polygon selector

Adds drop down menu with buffer and polygon options to perform a spatial query

## Style
Includes two icons for the UI buttons, you'll have to place them wherever you store your images and add these two lines to the CSS:
```css
/* gxp_spatial_selector */
.x-btn .gxp-icon-select-buffer, .x-menu-item .gxp-icon-select-buffer, .x-tree-node .gxp-icon-select-buffer {
    background-image: url(PATH/TO/IMAGES/icon_radar.png) !important;
}
.x-btn .gxp-icon-select-polygon, .x-menu-item .gxp-icon-select-polygon, .x-tree-node .gxp-icon-select-polygon {
   background-image: url(PATH/TO/IMAGES/polygon.png) !important;
}
```
Note: mind the paths to the images please.

## Setup
Invoque like any other GXP plugin within the tools of your app (default values below):
```javascript
tools: [
  {
    ptype: "gxp_spatialselector",
    buttonText: "Select...",
    bufferMenuText: "by Buffer",
    polygonMenuText: "by Polygon",
    selectTooltip: "Select features",
    controlOptions: {
      bufferCallback: function(evt){console.log(evt)},
      polygonCallback: function(evt){console.log(evt)}
    },
    showButtonText: true, //<- inherited from Tool Class
    actionTarget: "map.tbar", //<- not default, just example
    toggleGroup: "tools" ////<- not default, just example
  }
]
```

## Config
  * buttonText *{String}*: caption/label for select menu button
  * bufferMenuText *{String}*: caption/label for buffer selection option
  * polygonMenuText *{String}*: caption/label for polygon selection option
  * selectTooltip *{String}*: tooltip popup helper (on hover)
  * actionTarget *{String}*: panel.toolbar placement
  * toggleGroup *{String}*: can't have this working while other controls are in effect, include in group for auto activate/deactivate
  * bufferMenuText *{String}*: inherited from Tool Class, whether text should be rendered along the icon or not
  * controlOptions *{Object}*:
    * bufferCallback(evt) *{Function}*: callback function to execute on buffer draw
    * polygonCallback(evt) *{Function}*: callback function to execute on polygon draw (ended with double click on the last vertex)

## Callbacks
Both callbacks receive an Event object. Event object carries data according to spatial select operation.

The event is triggered on the control (OpenLayers.Control.DrawFeature) and handled by the plugin to execute these callbacks.
Shall you need more control over the callbacks, the events on the control are `buffer` and `aoi` (area of interest)

### bufferCallback
  * event.center: centroid of the drawn buffer
  * event.distance: radius of the drawn buffer
  * event.feature: raw feature for the buffer (40 sides regular polygon)

Note: coordinates and units will be in displayed projection units, you'll have to convert/transform to whatever you need otherwise

### bufferCallback
  * event.polygon: raw feature of the drawn polygon

## Example
Given example on a map app with EPSG:3857 projection
```javascript
{
  ptype: "gxp_spatialselector",
  controlOptions: {
    bufferCallback: function(evt){
      // feature to 4326 Lat/Lon
      // Tip: always clone your stuff, in case another handler needs the original event data
      var f = evt.feature.geometry.clone().transform('EPSG:3857','EPSG:4326');
      
      // center to 4326 Lat/Lon
      // Why? Cause my layer has its default units in 4326, so the CQL filter should
      // be built in those units. Careful.
      var c = evt.center.clone().transform('EPSG:3857','EPSG:4326');

      // I can't use the distance property, it comes in the displayed projection units
      // and I don't want to convert meters to lat/lon (read above)
      // Since distance in Lat/Lon is a pain and the buffer is always a cirlce(ish)
      // I take the distance from center.x to the bounds left/right
      var distanceDD = Math.abs(c.x - f.getBounds().left);
      // could also do it with a random vertex of the feature geometry:
      // distanceDD = c.distanceTo(f.getVertices()[0]);

      // From now on it's all just manipulation to ask some store to request the features.
      // I won't include an Ext.Window / Ext.grid.GridPanel sample, that's on you and this creepy framework
      
      //layers
      var layers = app.mapPanel.map // the app usually gets this namespace
        .getLayersByClass("OpenLayers.Layer.WMS")
        .filter(function(l){
          return l.params && l.visibility == true;
        })
        .map(function(l){
          return l.params.LAYERS;
        })
        .join(",");

      buffer_store.load({
        params: {
        'distance': distanceDD,
        'layers': layers,
        'center': String(c.x) + "," + String(c.y)
        },
        callback: function(){}
      });
    },
    polygonCallback: function(evt) {
      // geometry to 4326
      var g = evt.polygon.geometry.clone().transform('EPSG:3857','EPSG:4326');

      //layers
      var layers = app.mapPanel.map // the app usually gets this namespace
        .getLayersByClass("OpenLayers.Layer.WMS")
        .filter(function(l){
          return l.params && l.visibility == true;
        })
        .map(function(l){
          return l.params.LAYERS;
        })
        .join(",");

      polygon_store.load({
        params: {
          polygon: g,
          layers: layers
        },
        callback: function(){}
      });
    }
  },
  showButtonText: true,
  actionTarget: "map.tbar",
  toggleGroup: "tools"
}
```

## Node backend example
These are some small examples of how I handle the request from an express app in node:
### Buffer request
```javascript
var
  debug = require('debug')('wfsRequest:buffer')
  express = require("express"),
  url = require('url'),
  request = require('request'),
  bodyParser = require('body-parser');
  
module.exports = function wfsRequestBuffer() {

  var router = express.Router();
  router.post('/',
    bodyParser.urlencoded({extended: true }),
    function(req, res) {

      if(!req.body.layers || !req.body.center || !req.body.distance) {
        debug('Requested buffer lacks some parameters');
        return res.status(500).send('Buffer query needs layers, center and distance to work');
      }

      var center = req.body.center.split(',').join(' ');
      var distance = req.body.distance;
      var layers = req.body.layers;
      //remember, long first!

      var wfsrequest = {
        host: "SOME GEOSERVER URL WITH:PORT",
        pathname: "geoserver/wfs",
        protocol: "http",
        query: {
          request: "GetFeature",
          version: "1.0.0",
          service: "wfs",
          outputformat: "json",
          typename: layers,
          cql_filter: "DWITHIN(the_geom,POINT("+center+"),"+distance+",meters)"
        }
      };

      debug('WFS Request: %s', url.format(wfsrequest));
      var r = request(url.format(wfsrequest));
      r.on('error', function(e) {
        console.log("Error on HTTP request %s", e);
      });
      r.pipe(res).on('error', function(e) {
        console.log("Error on HTTP request %s", e);
        return res.status(500).send(e);
      });

    });

  return router;

}
```
### Polygon request
```javascript
var
  debug = require('debug')('wfsRequest:polygon')
  express = require("express"),
  url = require('url'),
  request = require('request'),
  bodyParser = require('body-parser');


module.exports = function wfsRequestPolygon() {

  var router = express.Router();
  router.post('/',
    bodyParser.urlencoded({extended: true }),
    function(req, res) {
      var layers = req.body.layers;
      var polygon = req.body.polygon;

      var wfsrequest = {
        host: "SOME GEOSERVER URL WITH:PORT",
        pathname: "geoserver/wfs",
        protocol: "http",
        query: {
          request: "GetFeature",
          version: "1.0.0",
          service: "wfs",
          outputformat: "json",
          typename: layers,
          cql_filter: "WITHIN(the_geom,"+polygon+")"
        }
      };

      debug('WFS Request: %s', url.format(wfsrequest));
      var r = request(url.format(wfsrequest));
      r.on('error', function(e) {
        console.log("Error on HTTP request %s", e);
      });
      r.pipe(res).on('error', function(e) {
        console.log("Error on HTTP request %s", e);
        return res.status(500).send(e);
      });
    });

  return router;

}
```
