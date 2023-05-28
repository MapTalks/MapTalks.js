import { extend } from '../../core/util';
// import Geometry from '../Geometry';
import InfoWindow from '../../ui/InfoWindow';
type Constructor = new (...args: any[]) => {};
/**
 * 
 * @mixin GeometryInfoWindow
 */
export default function GeometryInfoWindow<TBase extends Constructor>(Base: TBase) {
    return class extends Base {
        _infoWindow: any;
        _infoWinOptions: object;

        /** @lends Geometry.prototype */
        /**
         * Set an InfoWindow to the geometry
         * @param {Object} options - construct [options]{@link ui.InfoWindow#options} for the InfoWindow
         * @return {Geometry} this
         * @function GeometryInfoWindow.setInfoWindow
         * @example
         * geometry.setInfoWindow({
         *     title    : 'This is a title',
         *     content  : '<div style="color:#f00">This is content of the InfoWindow</div>'
         * });
         */
        setInfoWindow(options) {
            this.removeInfoWindow();
            if (options instanceof InfoWindow) {
                this._infoWindow = options;
                this._infoWinOptions = extend({}, this._infoWindow.options);
                this._infoWindow.addTo(this);
                return this;
            }
            this._infoWinOptions = extend({}, options);
            if (this._infoWindow) {
                this._infoWindow.setOptions(options);
                //@ts-ignore
            } else if (this.getMap()) {
                this._bindInfoWindow();
            }

            return this;
        }

        /**
         * Get the InfoWindow instance.
         * @return {ui.InfoWindow}
         * @function GeometryInfoWindow.getInfoWindow
         */
        getInfoWindow() {
            if (!this._infoWindow) {
                return null;
            }
            return this._infoWindow;
        }

        /**
         * Open the InfoWindow, default on the center of the geometry.
         * @param  {Coordinate} [coordinate=null] - coordinate to open the InfoWindow
         * @return {Geometry} this
         * @function GeometryInfoWindow.openInfoWindow
         */
        openInfoWindow(coordinate) {
            //@ts-ignore
            if (!this.getMap()) {
                return this;
            }
            if (!coordinate) {
                //@ts-ignore
                coordinate = this.getCenter();
            }
            if (!this._infoWindow) {
                //@ts-ignore
                if (this._infoWinOptions && this.getMap()) {
                    this._bindInfoWindow();
                    this._infoWindow.show(coordinate);
                }
            } else {
                this._infoWindow.show(coordinate);
            }
            return this;
        }

        /**
         * Close the InfoWindow
         * @return {Geometry} this
         * @function GeometryInfoWindow.closeInfoWindow
         */
        closeInfoWindow() {
            if (this._infoWindow) {
                this._infoWindow.hide();
            }
            return this;
        }

        /**
         * Remove the InfoWindow
         * @return {Geometry} this
         * @function GeometryInfoWindow.removeInfoWindow
         */
        removeInfoWindow() {
            this._unbindInfoWindow();
             //@ts-ignore
            delete this._infoWinOptions;
            delete this._infoWindow;
            return this;
        }

        _bindInfoWindow() {
            const options = this._infoWinOptions;
            if (!options) {
                return this;
            }
            this._infoWindow = new InfoWindow(options);
            this._infoWindow.addTo(this);

            return this;
        }

        _unbindInfoWindow() {
            if (this._infoWindow) {
                this.closeInfoWindow();
                this._infoWindow.remove();
                delete this._infoWindow;
            }
            return this;
        }
    }
}
