import { vec3 } from 'gl-matrix';
import { isNumber, extend, isArray } from './common/Util';
import BoundingBox from './BoundingBox';

const defaultDesc = {
    'positionSize' : 3,
    'primitive' : 'triangles',
    //name of position attribute
    'positionAttribute' : 'aPosition'
};

export default class Geometry {
    constructor(data, elements, count, desc) {
        this.data = data;
        this.elements = elements;
        this.desc = extend({}, defaultDesc, desc) || defaultDesc;
        const pos = data[this.desc.positionAttribute];
        if (!count) {
            if (elements) {
                count = getElementLength(elements);
            } else if (pos && pos.length) {
                count = pos.length / this.desc.positionSize;
            }
        }
        this.count = count;
        if (!this.elements) {
            this.elements = count;
        }
        this.properties = {};
        this.updateBoundingBox();
    }

    generateBuffers(regl) {
        //generate regl buffers beforehand to avoid repeated bufferData
        const data = this.data;
        const buffers = {};
        for (const p in data) {
            if (!data[p]) {
                continue;
            }
            buffers[p] = data[p].buffer && data[p].buffer.destroy ? data[p] : {
                buffer : regl.buffer(data[p])
            };
        }
        this.data = buffers;

        if (this.elements && !isNumber(this.elements)) {
            this.elements = this.elements.destroy ? this.elements : regl.elements({
                primitive: this.getPrimitive(),
                data: this.elements,
                //type : 'uint16' // type is inferred from data
            });
        }
    }

    /**
     * Replace data or refill attribute data buffer
     * @param {String} name - data's name
     * @param {Number[] | Object} data - data to update
     * @returns this
     */
    updateData(name, data) {
        const buf = this.data[name];
        if (!buf) {
            return this;
        }
        let buffer;
        this.data[name] = data;
        if (buf.buffer && buf.buffer.destroy) {
            buffer = buf;
        }
        if (name === this.desc.positionAttribute) {
            this.updateBoundingBox();
        }
        if (buffer) {
            buffer.buffer(data);
            this.data[name] = buffer;
        }
        return this;
    }

    getPrimitive() {
        return this.desc.primitive;
    }

    getAttributes() {
        return Object.keys(this.data);
    }

    getElements() {
        return this.elements;
    }

    setElements(elements, count) {
        if (!elements) {
            throw new Error('elements data is invalid');
        }
        const e = this.elements;
        this.count = count === undefined ? getElementLength(elements) : count;

        if (e.destroy) {
            const data = extend({}, elements, { primitive : this.getPrimitive() });
            this.elements = e(data);
        } else {
            this.elements = elements;
        }
        return this;
    }

    setDrawCount(count) {
        this.count1 = count;
        return this;
    }

    getDrawCount() {
        return this.count1 || this.count;
    }

    setDrawOffset(offset) {
        this.offset = offset;
        return this;
    }

    getDrawOffset() {
        return this.offset || 0;
    }

    dispose() {
        this._forEachBuffer(buffer => {
            buffer.destroy();
        });
        delete this.elements;
        delete this.data;
        this._disposed = true;
    }

    isDisposed() {
        return !!this._disposed;
    }

    /**
     * Update boundingBox of Geometry
     */
    updateBoundingBox() {
        let bbox = this.boundingBox;
        if (!bbox) {
            bbox = this.boundingBox = new BoundingBox();
        }
        const posAttr = this.desc.positionAttribute;
        let posArr = this.data[posAttr];
        if (!isArray(posArr)) {
            // form of object: { usage : 'static', data : [...] }
            posArr = posArr.data;
        }
        if (posArr && posArr.length) {
            //TODO only support size of 3 now
            const min = bbox.min;
            const max = bbox.max;
            vec3.set(min, posArr[0], posArr[1], posArr[2]);
            vec3.set(max, posArr[0], posArr[1], posArr[2]);
            for (let i = 3; i < posArr.length;) {
                const x = posArr[i++];
                const y = posArr[i++];
                const z = posArr[i++];
                if (x < min[0]) { min[0] = x; }
                if (y < min[1]) { min[1] = y; }
                if (z < min[2]) { min[2] = z; }

                if (x > max[0]) { max[0] = x; }
                if (y > max[1]) { max[1] = y; }
                if (z > max[2]) { max[2] = z; }
            }
            bbox.dirty();
        }
    }

    /**
     * Create barycentric attribute data
     * @param {String} name - attribute name for barycentric attribute
     */
    createBarycentric(name = 'aBarycentric') {
        const position = this.data[this.desc.positionAttribute];
        if (!isArray(position)) {
            throw new Error('Position data must be an array to create bary centric data');
        } else if (this.desc.primitive !== 'triangles') {
            throw new Error('Primitive must be triangles to create bary centric data');
        }
        const bary = new Uint8Array(position.length / this.desc.positionSize * 3);
        for (let i = 0, l = this.elements.length; i < l;) {
            for (let j = 0; j < 3; j++) {
                const ii = this.elements[i++];
                bary[ii * 3 + j] = 1;
            }
        }
        this.data[name] = bary;
    }

    /**
     * Build unique vertex data for each attribute
     */
    buildUniqueVertex() {
        const data = this.data;
        const indices = this.elements;
        if (!isArray(indices)) {
            throw new Error('elements must be array to build unique vertex.');
        }

        const keys = Object.keys(data);
        const oldData = {};

        const pos = data[this.desc.positionAttribute];
        if (!isArray(pos)) {
            throw new Error(this.desc.positionAttribute + ' must be array to build unique vertex.');
        }
        const vertexCount = pos.length / this.desc.positionSize;

        const l = indices.length;
        for (let i = 0; i < keys.length; i++) {
            const name = keys[i];
            const size = data[name].length / vertexCount;
            if (!isArray(data[name])) {
                throw new Error(name + ' must be array to build unique vertex.');
            }
            oldData[name] = data[name];
            oldData[name].size = size;
            data[name] = new data[name].constructor(l * size);
        }

        let cursor = 0;
        for (let i = 0; i < l; i++) {
            const idx = indices[i];
            for (let ii = 0; ii < keys.length; ii++) {
                const name = keys[ii];
                const array = data[name];
                const size = oldData[name].size;

                for (let k = 0; k < size; k++) {
                    array[cursor * size + k] = oldData[name][idx * size + k];
                }
            }
            indices[i] = cursor++;
        }
    }

    _forEachBuffer(fn) {
        if (this.elements && this.elements.destroy)  {
            fn(this.elements);
        }
        for (const p in this.data) {
            if (this.data.hasOwnProperty(p)) {
                if (this.data[p] && this.data[p].buffer && this.data[p].buffer.destroy) {
                    fn(this.data[p].buffer);
                }
            }
        }
    }
}

function getElementLength(elements) {
    if (isNumber(elements)) {
        return elements;
    } else if (elements.length !== undefined) {
        return elements.length;
    } else if (elements.data) {
        return elements.data.length;
    }
    throw new Error('invalid elements length');
}
