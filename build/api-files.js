/**
 * Source files to generate API Docs, to keep right parsing order.
 * @type {Array}
 */
const files = [
    './src/core',
    './src/geo',

    './src/handler/Handlerable.js',
    './src/handler/Handler.js',
    './src/handler/Drag.js',

    './src/map/spatial-reference',
    './src/map/Map.js',
    './src/map/Map.Anim.js',
    './src/map/Map.Camera.js',
    './src/map/Map.DomEvents.js',
    './src/map/Map.FullScreen.js',
    './src/map/Map.Pan.js',
    './src/map/Map.Profile.js',
    './src/map/Map.Topo.js',
    './src/map/Map.ViewHistory.js',
    './src/map/Map.Zoom.js',
    './src/map/Map.UI.js',
    './src/map/handler',

    './src/map/tool/MapTool.js',
    './src/map/tool/DrawTool.js',
    './src/map/tool/DrawToolRegister.js',
    './src/map/tool/DistanceTool.js',
    './src/map/tool/AreaTool.js',

    './src/geometry/Geometry.js',
    './src/geometry/ext/Geometry.Edit.js',
    './src/geometry/ext/Geometry.Drag.js',
    './src/geometry/ext/Geometry.Events.js',
    './src/geometry/ext/Geometry.Animation.js',
    './src/geometry/ext/Geometry.InfoWindow.js',
    './src/geometry/Path.js',
    './src/geometry/CenterMixin.js',
    './src/geometry/Marker.js',
    './src/geometry/TextMarker.js',
    './src/geometry/Label.js',
    './src/geometry/TextBox.js',
    './src/geometry/Polygon.js',
    './src/geometry/LineString.js',
    './src/geometry/Curve.js',
    './src/geometry/ArcCurve.js',
    './src/geometry/QuadBezierCurve.js',
    './src/geometry/CubicBezierCurve.js',
    './src/geometry/ConnectorLine.js',
    './src/geometry/Ellipse.js',
    './src/geometry/Circle.js',
    './src/geometry/Sector.js',
    './src/geometry/Rectangle.js',
    './src/geometry/GeometryCollection.js',
    './src/geometry/MultiGeometry.js',
    './src/geometry/MultiPoint.js',
    './src/geometry/MultiLineString.js',
    './src/geometry/MultiPolygon.js',
    './src/geometry/GeoJSON.js',
    './src/geometry/editor/GeometryEditor.js',
    './src/geometry/editor/TextEditable.js',

    './src/layer/Layer.js',
    './src/layer/tile/tileinfo/TileSystem.js',
    './src/layer/tile/tileinfo/TileConfig.js',
    './src/layer/tile/TileLayer.js',
    './src/layer/tile/GroupTileLayer.js',
    './src/layer/tile/WMSTileLayer.js',
    './src/layer/tile/CanvasTileLayer.js',
    './src/layer/OverlayLayer.js',
    './src/layer/VectorLayer.js',
    './src/layer/CanvasLayer.js',
    './src/layer/ParticleLayer.js',
    './src/layer/ImageLayer.js',

    './src/renderer/index.js',
    './src/renderer/Renderable.js',
    './src/renderer/layer/CanvasRenderer.js',

    './src/ui/index.js',
    './src/ui/UIComponent.js',
    './src/ui/UIMarker.js',
    './src/ui/InfoWindow.js',
    './src/ui/ToolTip.js',
    './src/ui/Menu.js',
    './src/ui/Menuable.js',

    './src/control/index.js',
    './src/control/Control.js',
    './src/control/Control.Zoom.js',
    './src/control/Control.Compass.js',
    './src/control/Control.LayerSwitcher.js',
    './src/control/Control.Attribution.js',
    './src/control/Control.Scale.js',
    './src/control/Control.Panel.js',
    './src/control/Control.Reset.js',
    './src/control/Control.Toolbar.js',
    './src/control/Control.Overview.js'
];

module.exports = files;
