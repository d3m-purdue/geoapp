/* Copyright 2015 Kitware Inc.
 *
 *  Licensed under the Apache License, Version 2.0 ( the "License" );
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

geoapp.mapLayers = {};

geoapp.MapLayer = function (map, datakey, arg) {
    'use strict';

    if (!(this instanceof geoapp.MapLayer)) {
        return new geoapp.MapLayer(map, datakey, arg);
    }
    arg = arg || {};

    var m_this = this,
        m_data;
    this.datakey = datakey;
    this.map = map;
    this.maximumMapPoints = 100000;
    this.maximumVectors = 50000;
    this.paramChangedKeys = [];

    /* Set or get the layer's data.
     *
     * @param data: if present, set the layer's data to this, otherwise return
     *              the current data.
     * @return: if the data parameter is undefined, return the current data,
     *          otherwise return the MapLayer object.
     */
    this.data = function (data) {
        if (data === undefined) {
            return m_data;
        }
        m_data = data;
        return m_this;
    };

    /* Check if a changing parameter means that this map layer needs to be
     * updated.
     *
     * @param params: the new parameters.
     * @param origParams: the parameters before the changes.
     * @param update: 'always' if this should always update if there is data
     *                present.
     * @return: true if the layer needs updating.
     */
    this.paramsChanged = function (params, origParams, update) {
        var changed = false;
        if (m_data && m_data.data && update === 'always') {
            return true;
        }
        this.paramChangedKeys.forEach(function (key) {
            changed = changed || (params[key] !== origParams[key]);
        });
        return changed;
    };

    /* Get the first and last dates of the data.
     *
     * @return: an object with start and end in epoch milliseconds, or null if
     *          we don't know how to compute the date range.
     */
    this.getDateRange = function () {
        if (!this.getDateColumn || !m_data || !m_data.data ||
                !m_data.data.length) {
            return null;
        }
        var col = this.getDateColumn(), data = m_data.data;
        var start = data[0][col], end = data[0][col];
        var i;
        for (i = 1; i < data.length; i += 1) {
            if (data[i][col] < start) {
                start = data[i][col];
            }
            if (data[i][col] > end) {
                end = data[i][col];
            }
        }
        return {start: start, end: end};
    };

    /* Check if a binned animation value is in the current display step.
     *
     * @param bin: the animation bin number.
     * @param numBins: the number of animation bins.
     * @param step: the current animation step [0-numBins).
     * @param subSteps: number of steps to group together.
     * @return: true if the bin should be shown, false otherwise. */
    this.inAnimationBin = function (bin, numBins, step, substeps) {
        if (bin < 0 || bin >= numBins) {
            return false;
        }
        return ((bin >= step && bin < step + substeps) ||
            bin + numBins < step + substeps);
    };
};

/* -------- taxi layer -------- */

geoapp.mapLayers.taxi = function (map, arg) {
    'use strict';
    var datakey = 'taxi';

    if (!(this instanceof geoapp.mapLayers[datakey])) {
        return new geoapp.mapLayers[datakey](map, arg);
    }
    arg = arg || {};
    geoapp.MapLayer.call(this, map, datakey, arg);

    var m_this = this,
        m_geoPoints, m_geoLines, m_geoPoly,

        m_pickupOnlyColor = geo.util.convertColor('black'),
        m_pickupColor = geo.util.convertColor('#0000FF'),
        m_dropoffOnlyColor = geo.util.convertColor('black'),
        m_dropoffColor = geo.util.convertColor('#FFFF00'),

        m_maxVectorScale = 5; /* Increase vector sizes */

    var geoLayer;

    geoLayer = map.getMap().createLayer('feature', {
        renderer: 'vgl'
    });
    m_geoPoints = geoLayer.createFeature('point', {
        primitiveShape: 'triangle',
        selectionAPI: false,
        dynamicDraw: true
    });
    geoLayer = map.getMap().createLayer('feature', {
        renderer: 'vgl'
    });
    m_geoPoly = geoLayer.createFeature('polygon', {
        selectionAPI: false,
        dynamicDraw: true
    });
    geoLayer = map.getMap().createLayer('feature', {
        renderer: 'vgl'
    });
    m_geoLines = geoLayer.createFeature('line', {
        selectionAPI: false,
        dynamicDraw: true
    });

    this.paramChangedKeys = [
        'display-type', 'display-process', 'display-num-bins',
        'display-max-points', 'display-max-lines', 'data-opacity',
        'show-taxi-data'
    ];

    /* Set the map to display pickup or dropoff points.
     *
     * @param displayType: either 'pickup' or 'dropoff'
     */
    this.setMapDisplayToPoints = function (displayType) {
        var data = m_this.data(), params = m_this.map.getMapParams();

        data.numPoints = Math.min(data.data.length, this.maximumMapPoints);
        data.numLines = 0;
        m_geoLines.data([]);
        data.numPolygons = 0;
        m_geoPoly.data([]);
        if (displayType === 'dropoff') {
            data.x_column = data.columns.dropoff_longitude;
            data.y_column = data.columns.dropoff_latitude;
        } else {
            data.x_column = data.columns.pickup_longitude;
            data.y_column = data.columns.pickup_latitude;
        }
        var pointData = data.data || [];
        if (pointData.length > this.maximumMapPoints) {
            pointData = data.data.slice(0, this.maximumMapPoints);
        }
        m_geoPoints.data(pointData)
        .style({
            fillColor: (displayType === 'dropoff' ?  m_dropoffOnlyColor :
                m_pickupOnlyColor),
            fillOpacity: params.opacity,
            stroke: false,
            radius: 5
        })
        .position(function (d) {
            return {
                x: d[data.x_column],
                y: d[data.y_column]
            };
        });
    };

    /* Set the map to display pickup to dropoff vectors.
     */
    this.setMapDisplayToVectors = function () {
        var data = m_this.data(), params = m_this.map.getMapParams(), item;

        data.numPoints = 0;
        m_geoPoints.data([]);
        data.numPolygons = 0;
        m_geoPoly.data([]);
        data.numLines = Math.min(data.data.length, this.maximumVectors);
        data.x1_column = data.columns.pickup_longitude;
        data.y1_column = data.columns.pickup_latitude;
        data.x2_column = data.columns.dropoff_longitude;
        data.y2_column = data.columns.dropoff_latitude;
        for (var i = 0; i < data.data.length; i += 1) {
            item = data.data[i];
            if (m_this.map.isBadPoint(item, data)) {
                item.hide = true;
            }
        }
        var lineRecord = [{
            x_column: data.x1_column,
            y_column: data.y1_column,
            strokeColor: m_pickupColor
        }, {
            x_column: data.x2_column,
            y_column: data.y2_column,
            strokeColor: m_dropoffColor
        }];
        var lineData = data.data;
        if (lineData.length > this.maximumVectors) {
            lineData = data.data.slice(0, this.maximumVectors);
        }

        m_geoLines.data(lineData)
        .line(function () {
            return lineRecord;
        })
        .position(function (d, didx, item, iidx) {
            var dat = lineData[iidx];
            return {
                x: dat[d.x_column],
                y: dat[d.y_column]
            };
        })
        .style({
            strokeColor: function (d) {
                return d.strokeColor;
            },
            strokeWidth: 5,
            strokeOpacity: function (d, didx, item, iidx) {
                return lineData[iidx].hide ? -1 : params.opacity;
            }
        });
    };

    /* Set the map to display pickup AND dropoff points.
     */
    this.setMapDisplayToBothPoints = function () {
        var data = m_this.data(), params = m_this.map.getMapParams(),
            pointData = data.data, i;

        data.numPoints = Math.min(data.data.length, this.maximumMapPoints) * 2;
        data.numLines = 0;
        m_geoLines.data([]);
        data.numPolygons = 0;
        m_geoPoly.data([]);

        data.x1_column = data.columns.pickup_longitude;
        data.y1_column = data.columns.pickup_latitude;
        data.x2_column = data.columns.dropoff_longitude;
        data.y2_column = data.columns.dropoff_latitude;
        var pointArray = new Array(data.numPoints);
        for (i = 0; i < pointArray.length; i += 1) {
            pointArray[i] = i;
        }
        m_geoPoints.data(pointArray)
        .style({
            fillColor: function (d) {
                /*jshint bitwise: false */
                return (!(d & 1)) ? m_pickupColor : m_dropoffColor;
            },
            fillOpacity: params.opacity,
            stroke: false,
            radius: 5
        })
        .position(function (d) {
            /*jshint bitwise: false */
            var i = d >> 1;
            /*jshint bitwise: false */
            if (!(d & 1)) {
                return {
                    x: pointData[i][data.x1_column],
                    y: pointData[i][data.y1_column]
                };
            } else {
                return {
                    x: pointData[i][data.x2_column],
                    y: pointData[i][data.y2_column]
                };
            }
        });
    };

    /* Make sure a bin exists.  If not, create it.
     *
     * @param bins: object to store bins.
     * @param x: first bin coordinate.
     * @param y: second bin coordiante.
     * @return: the desired bin.
     */
    this.ensureBinExists = function (bins, x, y) {
        if (!bins[x]) {
            bins[x] = {};
        }
        if (!bins[x][y]) {
            bins[x][y] = {
                x: x, y: y,
                pickups: 0, pickupPoints: [],
                dropoffs: 0, dropoffPoints: [],
                dx: 0, dy: 0, count: 0
            };
        }
        return bins[x][y];
    };

    /* Bin the map data.
     *
     * @param params: the display parameters for the map.
     * @param anim: animation options.  null for full display.
     * @param step: if animation options are specified, this is the step of the
     *              animation.
     * @param resetmax: if animation options are specified and this is true,
     *                  reset the bin max values.
     */
    this.binMapData = function (params, anim, step, resetmax) {
        var numBins = Math.max(params['display-num-bins'] || 15, 5);
        var node = m_this.map.getMap().node(),
            width = node.width(), height = node.height(),
            bounds = m_this.map.getMap().bounds();
        var binSize = Math.min(width, height) / numBins;
        var x0 = bounds.upperLeft.x, x1 = bounds.lowerRight.x,
            y1 = bounds.upperLeft.y, y0 = bounds.lowerRight.y;
        var binW = (x1 - x0) / width * binSize,
            binH = (y1 - y0) / height * binSize;
        var maxx = width <= height ? numBins : Math.ceil((x1 - x0) / binW),
            maxy = height <= width ? numBins : Math.ceil((y1 - y0) / binH);
        var binX0 = x0 + (x1 - x0 - binW * maxx) / 2;
        var binY0 = y0 + (y1 - y0 - binH * maxy) / 2;
        var data = m_this.data();
        data.x1_column = data.columns.pickup_longitude;
        data.y1_column = data.columns.pickup_latitude;
        data.x2_column = data.columns.dropoff_longitude;
        data.y2_column = data.columns.dropoff_latitude;
        var x, y, i, item, checkedBad;
        var bins = {}, bin;
        var computeVectors = (params['display-type'] === 'vector');

        for (i = 0; i < data.data.length; i += 1) {
            item = data.data[i];
            checkedBad = null;
            if (!anim || this.inAnimationBin(
                    anim.layers[this.datakey].dataBin[i], anim.numBins, step,
                    anim.substeps)) {
                x = (item[data.x1_column] - binX0) / binW;
                y = (item[data.y1_column] - binY0) / binH;
                if (x >= 0 && x < maxx && y >= 0 && y < maxy) {
                    x = Math.floor(x);
                    y = Math.floor(y);
                    bin = this.ensureBinExists(bins, x, y);
                    bin.pickups += 1;
                    bin.pickupPoints.push(i);
                    if (computeVectors) {
                        checkedBad = m_this.map.isBadPoint(item, data);
                        if (!checkedBad) {
                            bin.dx += (item[data.x2_column] -
                                item[data.x1_column]);
                            bin.dy += (item[data.y2_column] -
                                item[data.y1_column]);
                            bin.count += 1;
                        }
                    }
                }
            }
            if (!anim || this.inAnimationBin(
                    anim.layers[this.datakey].dataBin2[i], anim.numBins, step,
                    anim.substeps)) {
                x = (item[data.x2_column] - binX0) / binW;
                y = (item[data.y2_column] - binY0) / binH;
                if (x >= 0 && x < maxx && y >= 0 && y < maxy) {
                    x = Math.floor(x);
                    y = Math.floor(y);
                    bin = this.ensureBinExists(bins, x, y);
                    bin.dropoffs += 1;
                    bin.dropoffPoints.push(i);
                    if (computeVectors) {
                        if (checkedBad === null) {
                            checkedBad = m_this.map.isBadPoint(item, data);
                        }
                        if (!checkedBad) {
                            bin.dx -= (item[data.x2_column] -
                                item[data.x1_column]);
                            bin.dy -= (item[data.y2_column] -
                                item[data.y1_column]);
                            bin.count += 1;
                        }
                    }
                }
            }
        }
        data.bins = bins;
        var maxpickup = 0, maxdropoff = 0, maxflux = 0, maxvector = 0;
        if (anim && !resetmax && data.binAnimParams) {
            maxpickup = data.binAnimParams.maxpickup || 0;
            maxdropoff = data.binAnimParams.maxdropoff || 0;
            maxflux = data.binAnimParams.maxflux || 0;
            maxvector = data.binAnimParams.maxvector || 0;
        }
        data.binParams = {
            extents: {x0: x0, y0: y0, x1: x1, y1: y1},
            screen: {w: width, h: height},
            w: binW,
            h: binH,
            x0: binX0,
            y0: binY0,
            binSize: binSize
        };
        var bp = data.binParams;

        _.each(bins, function (binx, x) {
            _.each(binx, function (bin, y) {
                var flux, dx, dy, ctr, vec;

                flux = Math.abs(bin.pickups - bin.dropoffs);
                if (flux > maxflux) {
                    maxflux = flux;
                }
                if (bins[x][y].pickups > maxpickup) {
                    maxpickup = bins[x][y].pickups;
                }
                if (bins[x][y].dropoffs > maxdropoff) {
                    maxdropoff = bins[x][y].dropoffs;
                }
                if (!bin.count) {
                    return;
                }
                dx = bin.dx / bin.count;
                dy = bin.dy / bin.count;
                ctr = {
                    x: (bin.x + 0.5) * bp.w + bp.x0,
                    y: (bin.y + 0.5) * bp.h + bp.y0
                };
                bin.dx /= bin.count;  bin.dy /= bin.count;
                if (params['display-vector-length'] !== 'full') {
                    vec = m_this.map.getMap().gcsToDisplay({x: ctr.x + dx, y: ctr.y + dy});
                    ctr = m_this.map.getMap().gcsToDisplay(ctr);
                    bin.dx = vec.x - ctr.x;
                    bin.dy = vec.y - ctr.y;
                    bin.veclen = Math.sqrt(bin.dx * bin.dx + bin.dy * bin.dy);
                    bin.theta = Math.atan2(bin.dy, bin.dx);
                    if (bin.veclen > maxvector && bin.count >= 10) {
                        maxvector = bin.veclen;
                    }
                }
            });
        });
        bp.maxflux = maxflux;
        bp.maxpickup = maxpickup;
        bp.maxdropoff = maxdropoff;
        bp.maxvector = maxvector;
        if (anim) {
            data.binAnimParams = {
                maxflux: maxflux,
                maxpickup: maxpickup,
                maxdropoff: maxdropoff,
                maxvector: maxvector
            };
        }
    };

    /* Set the map data to polygons representing the binned data.
     *
     * @param params: the display parameters for the map.
     * @param anim: animation options.  null for full display.
     */
    this.setMapDisplayToBinnedData = function (params) {
        var data = m_this.data();
        var bp = data.binParams;

        data.numLines = 0;
        m_geoLines.data([]);
        data.numPoints = 0;
        m_geoPoints.data([]);

        var polyData = [];
        var coor = [{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 1}, {x: 1, y: 0},
                    {x: 0, y: 0}];
        _.each(data.bins, function (binx, x) {
            _.each(binx, function (bin, y) {
                polyData.push({bin: bin, outer: coor});
            });
        });
        data.numPolygons = polyData.length;

        m_geoPoly.data(polyData)
        .position(function (d, didx, item) {
            var bin = item.bin;
            return {
                x: (bin.x + d.x) * bp.w + bp.x0,
                y: (bin.y + d.y) * bp.h + bp.y0
            };
        })
        .style({
            fillColor: function (d, didx, item) {
                switch (params['display-type']) {
                    case 'both': case 'vector':
                        return (item.bin.pickups > item.bin.dropoffs ?
                        m_pickupColor : m_dropoffColor);
                    case 'dropoff':
                        return m_dropoffOnlyColor;
                    default:
                        return m_pickupOnlyColor;
                }
            },
            fillOpacity: function (d, didx, item) {
                var val;
                switch (params['display-type']) {
                    case 'both': case 'vector':
                        val = Math.abs(item.bin.pickups -
                            item.bin.dropoffs) / bp.maxflux;
                        break;
                    case 'dropoff':
                        val = item.bin.dropoffs / bp.maxdropoff;
                        break;
                    default:
                        val = item.bin.pickups / bp.maxpickup;
                        break;
                }
                /* We may want to apply a power function.  For instance,
                 *   return Math.pow(val, Math.log10(2));
                 * would scale 0.1 to 0.5, 0.01 to 0.25, etc. */
                return val;
            }
        });
        if (params['display-type'] === 'vector' && (bp.maxvector ||
                params['display-vector-length'] === 'full')) {
            var lineRecord = [0, 1];
            var maxvector = (bp.maxvector || 0) / m_maxVectorScale;
            m_geoLines.data(polyData)
            .line(function () {
                return lineRecord;
            })
            .position(function (d, didx, item, iidx) {
                var bin = polyData[iidx].bin;
                var coor = {
                    x: (bin.x + 0.5) * bp.w + bp.x0,
                    y: (bin.y + 0.5) * bp.h + bp.y0
                };
                if (d) {
                    if (params['display-vector-length'] !== 'full') {
                        var veclen = (bin.veclen < maxvector ?
                            bin.veclen : maxvector);
                        veclen *= bp.binSize / maxvector / 2;
                        coor = m_this.map.getMap().gcsToDisplay(coor);
                        coor.x += Math.cos(bin.theta) * veclen;
                        coor.y += Math.sin(bin.theta) * veclen;
                        coor = m_this.map.getMap().displayToGcs(coor);
                    } else {
                        coor.x += bin.dx;
                        coor.y += bin.dy;
                    }
                }
                return coor;
            })
            .style({
                strokeColor: 'black',
                strokeWidth: 5,
                strokeOpacity: function (d, didx, item, iidx) {
                    var bin = polyData[iidx].bin;
                    var val = Math.abs(bin.pickups - bin.dropoffs) / bp.maxflux;
                    return val;
                }
            });
        }
    };

    /* Update the taxi map based on the map parameters.  Values that are
     * updated include:
     *    display-type: 'pickup', 'dropoff', 'both', or 'vector'.
     *    display-process: 'raw' or 'binned'.
     *    opacity: the opacity used for non-animated points and lines.
     *
     * @param params: the new map parameters.
     */
    this.updateMapParams = function (params) {
        var data = m_this.data(),
            visible = (params['show-taxi-data'] !== false && data);
        m_geoPoints.visible(visible);
        m_geoLines.visible(visible);
        m_geoPoly.visible(visible);
        if (!visible) {
            return;
        }
        if (params['display-max-points'] > 0) {
            this.maximumMapPoints = params['display-max-points'];
        }
        if (params['display-max-lines'] > 0) {
            this.maximumVectors = params['display-max-lines'];
        }
        if (params['data-opacity'] > 0) {
            params.opacity = params['data-opacity'];
        }
        switch (params['display-process']) {
            case 'binned':
                this.binMapData(params);
                this.setMapDisplayToBinnedData(params);
                break;
            default:
                switch (params['display-type']) {
                    case 'both':
                        this.setMapDisplayToBothPoints();
                        break;
                    case 'dropoff':
                        this.setMapDisplayToPoints(params['display-type']);
                        break;
                    case 'vector':
                        this.setMapDisplayToVectors();
                        break;
                    default:
                        this.setMapDisplayToPoints('pickup');
                        break;
                }
                break;
        }
    };

    /* Return the index of the date column for this data.
     *
     * @return: the date column, or null if undefined. */
    this.getDateColumn = function () {
        var params = m_this.map.getMapParams(),
            data = m_this.data();
        if (!data || !data.columns) {
            return null;
        }
        if (params['display-type'] === 'dropoff' &&
            params['display-process'] !== 'binned') {
            return data.columns.dropoff_datetime;
        }
        return data.columns.pickup_datetime;
    };

    /* Calculate bins for animation
     *
     * @param param: animation parameters.  The dataBin field should be added
     *               at a minimum.
     * @param start: start of animation interval in epoch milliseconds.
     * @param range: milliseconds for animation cycle (for instance, if this is
     *               showing one week, collecting all the weeks in a year, this
     *               is the number of ms in a week).
     * @param binWidth: width of each bin in milliseconds.
     */
    this.binForAnimation = function (params, start, range, binWidth) {
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            dateColumn = this.getDateColumn(),
            data, dateColumn2, i;

        if (!mapData || !mapData.data) {
            return;
        }
        data = mapData.data;
        dateColumn2 = mapData.columns.dropoff_datetime;
        var dataLength = mapData.numPoints;
        if (mapParams['display-type'] === 'vector') {
            dataLength = mapData.numLines;
        }
        if (mapParams['display-process'] === 'binned') {
            dataLength = data.length;
        }
        var dataBin = new Int32Array(dataLength);
        params.layers[this.datakey] = {dataBin: dataBin};

        switch (mapParams['display-process']) {
            case 'binned':
                var dataBin2 = new Int32Array(dataLength);
                params.layers[this.datakey].dataBin2 = dataBin2;
                for (i = 0; i < data.length; i += 1) {
                    dataBin[i] = Math.floor(((
                        data[i][dateColumn] - start) % range) / binWidth);
                    dataBin2[i] = Math.floor(((
                        data[i][dateColumn2] - start) % range) / binWidth);
                }
                /* Calculate a general scale */
                for (i = 0; i < params.numBins; i += params.substeps) {
                    this.binMapData(mapParams, params, i, !i);
                }
                break;
            default:
                switch (mapParams['display-type']) {
                    case 'both':
                        for (i = 0; i < mapData.numPoints; i += 1) {
                            /*jshint bitwise: false */
                            dataBin[i] = Math.floor(((
                                data[i >> 1][(!(i & 1)) ? dateColumn :
                                dateColumn2] - start) % range) / binWidth);
                        }
                        break;
                    case 'vector':
                        for (i = 0; i < mapData.numLines; i += 1) {
                            dataBin[i] = Math.floor(((
                                data[i][dateColumn] - start) % range) /
                                binWidth);
                        }
                        break;
                    default:
                        for (i = 0; i < mapData.numPoints; i += 1) {
                            dataBin[i] = Math.floor(((
                                data[i][dateColumn] - start) % range) /
                                binWidth);
                        }
                        break;
                }
                break;
        }
    };

    /* Update the animation frame for this layer.
     *
     * @param options: animation options.
     */
    this.animateFrame = function (options) {
        if (!options.layers[this.datakey]) {
            return;
        }
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            visOpac = (options.opacity || 0.1),
            dataBin = options.layers[this.datakey].dataBin,
            i, j, v, bin, opac, vis, vpf;

        if (mapParams['data-opacity']) {
            visOpac = Math.min(mapParams['data-opacity'] * 1.5, 1);
        }
        if (mapParams['display-process'] === 'binned') {
            this.binMapData(mapParams, options, options.step);
            this.setMapDisplayToBinnedData(mapParams);
        } else if (mapData.numPoints) {
            vpf = m_geoPoints.verticesPerFeature();
            opac = m_geoPoints.actors()[0].mapper().getSourceBuffer(
                'fillOpacity');
            for (i = 0, v = 0; i < mapData.numPoints; i += 1) {
                vis = this.inAnimationBin(
                    dataBin[i], options.numBins, options.step,
                    options.substeps);
                vis = (vis ? visOpac : 0);
                for (j = 0; j < vpf; j += 1, v += 1) {
                    opac[v] = vis;
                }
            }
            m_geoPoints.actors()[0].mapper().updateSourceBuffer('fillOpacity');
        } else if (mapData.numLines) {
            vpf = m_geoLines.verticesPerFeature();
            opac = m_geoLines.actors()[0].mapper().getSourceBuffer(
                'strokeOpacity');
            for (i = 0, v = 0; i < mapData.numLines; i += 1) {
                vis = this.inAnimationBin(
                    dataBin[i], options.numBins, options.step,
                    options.substeps);
                vis = (vis && !mapData.data[i].hide ? visOpac : -1);
                for (j = 0; j < vpf; j += 1, v += 1) {
                    opac[v] = vis;
                }
            }
            m_geoLines.actors()[0].mapper().updateSourceBuffer(
                'strokeOpacity');
        }
    };

    /* Stop any animation and show the unanimated data.
     */
    this.animateStop = function () {
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            vpf, opac, v;

        if (mapParams['display-process'] === 'binned') {
            this.binMapData(mapParams);
            this.setMapDisplayToBinnedData(mapParams);
        } else if (mapData.numPoints) {
            vpf = m_geoPoints.verticesPerFeature();
            opac = m_geoPoints.actors()[0].mapper().getSourceBuffer(
                'fillOpacity');
            for (v = 0; v < mapData.numPoints * vpf; v += 1) {
                opac[v] = mapParams.opacity;
            }
            m_geoPoints.actors()[0].mapper().updateSourceBuffer(
                'fillOpacity');
        } else if (mapData.numLines) {
            vpf = m_geoLines.verticesPerFeature();
            opac = m_geoLines.actors()[0].mapper().getSourceBuffer(
                'strokeOpacity');
            for (var i = 0, j = 0; i < mapData.numLines; i += 1) {
                for (v = 0; v < vpf; v += 1, j += 1) {
                    opac[j] = (mapData.data[i].hide ? 0 : mapParams.opacity);
                }
            }
            m_geoLines.actors()[0].mapper().updateSourceBuffer(
                'strokeOpacity');
        }
    };

    /* Return the current internal state of the layer.
     *
     * @param key: the key of the object to fetch, or undefined for a
     *             dictionary of objects.
     * @returns: a dictionary of the current state, or one of the internal
     *           state objects.
     */
    this.getInternalState = function (key) {
        var state = {
            geoPoints: m_geoPoints,
            geoLines: m_geoLines,
            geoPoly: m_geoPoly,
            pickupOnlyColor: m_pickupOnlyColor,
            pickupColor: m_pickupColor,
            dropoffOnlyColor: m_dropoffOnlyColor,
            dropoffColor: m_dropoffColor,
            maxVectorScale: m_maxVectorScale
        };
        if (key) {
            return state[key];
        }
        return state;
    };
};

inherit(geoapp.mapLayers.taxi, geoapp.MapLayer);

/* -------- instagram layer -------- */

geoapp.mapLayers.instagram = function (map, arg) {
    'use strict';
    var datakey = 'instagram';

    if (!(this instanceof geoapp.mapLayers[datakey])) {
        return new geoapp.mapLayers[datakey](map, arg);
    }
    arg = arg || {};
    geoapp.MapLayer.call(this, map, datakey, arg);

    var m_this = this,
        m_geoPoints,
        m_overlayTimer,
        m_mapEventsSet,
        m_currentPoint = null,
        m_currentPointSource = '',
        m_persistentCurrentPoint = false,
        m_inPoints = {top: [], other: []},
        m_lastMouseDownEvent,
        m_lastPanEvent,

        m_defaultOpacity = 0.1,
        m_pointColor = geo.util.convertColor('#FF0000'),
        m_strokeColor = geo.util.convertColor('#E69F00');

    var geoLayer;

    geoLayer = map.getMap().createLayer('feature', {
        renderer: 'vgl'
    });
    m_geoPoints = geoLayer.createFeature('point', {
        primitiveShape: 'triangle',
        selectionAPI: true,
        dynamicDraw: true
    });

    this.paramChangedKeys = [
        'data-opacity', 'show-instagram-data'
    ];

    /* Update the taxi map based on the map parameters.  Values that are
     * updated include:
     *    inst-opacity: the opacity used for non-animated points.
     *
     * @param params: the new map parameters.
     */
    this.updateMapParams = function (params) {
        var data = m_this.data(),
            visible = (params['show-instagram-data'] !== false && data);
        m_geoPoints.visible(visible);
        if (!visible) {
            return;
        }
        if (params['display-max-points'] > 0) {
            this.maximumMapPoints = params['display-max-points'];
        }
        if (params['data-opacity'] > 0) {
            params['inst-opacity'] = params['data-opacity'];
        }
        data.numPoints = Math.min(data.data.length, this.maximumMapPoints);
        data.x_column = data.columns.longitude;
        data.y_column = data.columns.latitude;
        var pointData = data.data || [];
        if (pointData.length > this.maximumMapPoints) {
            pointData = data.data.slice(0, this.maximumMapPoints);
        }
        m_geoPoints.data(pointData)
        .style({
            fillColor: m_pointColor,
            fillOpacity: params['inst-opacity'] || m_defaultOpacity,
            strokeColor: m_strokeColor,
            strokeOpacity: 1,
            strokeWidth: 5,
            stroke: false,
            radius: 5
        })
        .position(function (d) {
            return {
                x: d[data.x_column],
                y: d[data.y_column]
            };
        })
        .geoOff(geo.event.feature.mouseover)
        .geoOn(geo.event.feature.mouseover, function (evt) {
            m_this.highlightPoint(evt.index, evt, true);
        })
        .geoOff(geo.event.feature.mouseout)
        .geoOn(geo.event.feature.mouseout, function (evt) {
            m_this.highlightPoint(evt.index, evt, false);
        });
        m_geoPoints.layer().geoOff(geo.event.pan)
        .geoOn(geo.event.pan, m_this.panLayer);
        $(this.map.getMap().node()).off('.instagram-map-layer').on(
            'mousedown.instagram-map-layer click.instagram-map-layer',
            m_this.clickLayer);
        this.currentPoint(null, false);
    };

    /* Return the index of the date column for this data.
     *
     * @return: the date column, or null if undefined. */
    this.getDateColumn = function () {
        var params = m_this.map.getMapParams(),
            data = m_this.data();
        if (!data || !data.columns) {
            return null;
        }
        return data.columns.posted_date;
    };

    /* Calculate bins for animation
     *
     * @param param: animation parameters.  The dataBin field should be added
     *               at a minimum.
     * @param start: start of animation interval in epoch milliseconds.
     * @param range: milliseconds for animation cycle (for instance, if this is
     *               showing one week, collecting all the weeks in a year, this
     *               is the number of ms in a week).
     * @param binWidth: width of each bin in milliseconds.
     */
    this.binForAnimation = function (params, start, range, binWidth) {
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            dateColumn = this.getDateColumn(),
            data, i;

        if (!mapData || !mapData.data) {
            return;
        }
        data = mapData.data;
        var dataLength = mapData.numPoints;
        var dataBin = new Int32Array(dataLength);
        params.layers[this.datakey] = {dataBin: dataBin};
        for (i = 0; i < mapData.numPoints; i += 1) {
            dataBin[i] = Math.floor(((
                data[i][dateColumn] - start) % range) /
                binWidth);
        }
    };

    /* Update the animation frame for this layer.
     *
     * @param options: animation options.
     */
    this.animateFrame = function (options) {
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            visOpac = (options.opacity || 0.1),
            dataBin = options.layers[this.datakey].dataBin,
            i, j, v, bin, opac, vis, vpf;

        if (mapParams['data-opacity']) {
            visOpac = Math.min(mapParams['data-opacity'] * 1.5, 1);
        }
        vpf = m_geoPoints.verticesPerFeature();
        opac = m_geoPoints.actors()[0].mapper().getSourceBuffer('fillOpacity');
        for (i = 0, v = 0; i < mapData.numPoints; i += 1) {
            vis = this.inAnimationBin(
                dataBin[i], options.numBins, options.step,
                options.substeps);
            vis = (vis ? visOpac : 0);
            for (j = 0; j < vpf; j += 1, v += 1) {
                opac[v] = vis;
            }
        }
        m_geoPoints.actors()[0].mapper().updateSourceBuffer('fillOpacity');
    };

    /* Stop any animation and show the unanimated data.
     */
    this.animateStop = function () {
        var mapParams = m_this.map.getMapParams(),
            mapData = m_this.data(),
            vpf, opac, v;

        vpf = m_geoPoints.verticesPerFeature();
        opac = m_geoPoints.actors()[0].mapper().getSourceBuffer('fillOpacity');
        for (v = 0; v < mapData.numPoints * vpf; v += 1) {
            opac[v] = mapParams['inst-opacity'] || m_defaultOpacity;
        }
        m_geoPoints.actors()[0].mapper().updateSourceBuffer(
            'fillOpacity');
    };

    /* Return the current internal state of the layer.
     *
     * @param key: the key of the object to fetch, or undefined for a
     *             dictionary of objects.
     * @returns: a dictionary of the current state, or one of the internal
     *           state objects.
     */
    this.getInternalState = function (key) {
        var state = {
            geoPoints: m_geoPoints,
            defaultOpacity: m_defaultOpacity,
            currentPoint: m_currentPoint,
            currentPointSource: m_currentPointSource,
            persistentCurrentPoint: m_persistentCurrentPoint,
            inPoints: m_inPoints,
            pointColor: m_pointColor,
            strokeColor: m_strokeColor
        };
        if (key) {
            return state[key];
        }
        return state;
    };

    /* When the mouse hovers above a point on the map, indicate this.
     *
     * @param idx: 0-based index in the data array.
     * @param evt: the event that triggered this call.
     * @param over: true if the mouse if over the point, false if it just left.
     */
    this.highlightPoint = function (idx, evt, over) {
        var vpf = m_geoPoints.verticesPerFeature(),
            cur = null,
            opac;
        if (over) {
            opac = m_geoPoints.actors()[0].mapper().getSourceBuffer(
                'fillOpacity');
            if (idx * vpf >= opac.length || !opac[idx * vpf]) {
                over = false;
            }
        }
        if ((!over || !evt.top) && $.inArray(idx, m_inPoints.top) >= 0) {
            m_inPoints.top.splice($.inArray(idx, m_inPoints.top), 1);
        }
        if ((!over || evt.top) && $.inArray(idx, m_inPoints.other) >= 0) {
            m_inPoints.other.splice($.inArray(idx, m_inPoints.other), 1);
        }
        if (over && evt.top && $.inArray(idx, m_inPoints.top) < 0) {
            m_inPoints.top.push(idx);
        }
        if (over && !evt.top && $.inArray(idx, m_inPoints.other) < 0) {
            m_inPoints.other.push(idx);
        }
        if (!m_persistentCurrentPoint) {
            this.currentPoint(this.getHighlightPoint(), undefined, undefined,
                              'map');
        }
    };

    /* Return the first top-most point that should be highlighted by a hovered
     * or clicked mouse.
     *
     * @return: the 0-based point index or null.
     */
    this.getHighlightPoint = function () {
        if (m_inPoints.top.length) {
            return m_inPoints.top[0];
        }
        if (m_inPoints.other.length) {
            return m_inPoints.other[0];
        }
        return null;
    };

    /* Handle clicking on the map.  Set the current point according to
     * highlighting rules to a persistent point.
     *
     * @param evt: the event that triggered this call.
     */
    this.clickLayer = function (evt) {
        if (evt.type === 'mousedown') {
            m_lastMouseDownEvent = new Date().getTime();
            return;
        }
        if (m_lastMouseDownEvent < m_lastPanEvent) {
            return;
        }
        var idx = m_this.getHighlightPoint();
        m_this.persistentCurrentPoint(idx);
        m_this.currentPoint(idx, true, true, 'map');
        evt.stopPropagation();
        evt.preventDefault();
    };

    /* When the map is panned, record that it was done so that we can
     * differentiate a click from a pan.  If we have a persistent overlay,
     * adjust its position.
     *
     * @param evt: the event that triggered this call.
     */
    this.panLayer = function (evt) {
        m_lastPanEvent = new Date().getTime();
        if (m_persistentCurrentPoint && m_currentPoint !== null) {
            m_this.showOverlay(true);
        }
    };

    /* Get or set a point as the current point.  If setting, mark it as the
     * current point and set a timer to display the instagram picture soon.
     *
     * @param cur: undefined to get the current point.  Otherwise, the 0-based
     *             point index, or null to clear the current point.
     * @param redraw: if false, don't redraw the map.  If true, always update.
     * @param immediate: if true, show or hide the overlay immediately.
     * @param source: name of the source of setting this point.  Used in
     *                logging.
     * @param currentPoint: the current point (an integer) or null if there is
     *                      no current point.
     */
    this.currentPoint = function (cur, redraw, immediate, source) {
        if (cur === undefined) {
            return m_currentPoint;
        }
        m_currentPointSource = source || m_currentPointSource || '';
        cur = !isNaN(parseInt(cur)) ? parseInt(cur) : null;
        if (cur === m_currentPoint && redraw !== true) {
            return m_currentPoint;
        }
        if (cur === null) {
            m_persistentCurrentPoint = false;
        }
        var vpf = m_geoPoints.verticesPerFeature(),
            stroke, i, old = m_currentPoint;

        stroke = m_geoPoints.actors()[0].mapper().getSourceBuffer('stroke');
        for (i = 0; i < vpf; i += 1) {
            if (old !== null && old * vpf < stroke.length) {
                stroke[old * vpf + i] = 0;
            }
            if (cur !== null && cur * vpf < stroke.length) {
                stroke[cur * vpf + i] = 1;
            }
        }
        m_geoPoints.actors()[0].mapper().updateSourceBuffer('stroke');
        if (redraw !== false) {
            this.map.triggerDraw();
        }
        m_currentPoint = cur;
        /* If no point is selected, use a shorter timeout for the overlay. */
        var delay = !cur ? 125 : 250;
        if (m_overlayTimer) {
            window.clearTimeout(m_overlayTimer);
            m_overlayTimer = null;
        }
        if (!immediate) {
            m_overlayTimer = window.setTimeout(this.showOverlay, delay);
        } else {
            this.showOverlay();
        }
        if (cur && !m_mapEventsSet && $('#ga-main-map').length) {
            $('#ga-main-map').on('mouseleave', function () {
                if (!m_persistentCurrentPoint) {
                    m_this.currentPoint(null);
                }
            });
            m_mapEventsSet = true;
        }
        return m_currentPoint;
    };

    /* Get or set if the current point is persistent. If it is persistent, a
     * close icon is shown on the overlay.
     *
     * @param persistent: if undefined, just return the state of persistence.
     *                    If an integer or a string that can be cast to an
     *                    integer, set the persistence if this value is not the
     *                    same as the current point or persistence if off.  If
     *                    persistence in on and this is the currenr point,
     *                    toggle it off.  If not an integer, set the
     *                    persistence to the truthiness of this value.
     * @param source: source of this call for logging.
     * @return: a boolean with the state of persistence.
     */
    this.persistentCurrentPoint = function (persistent, source) {
        if (persistent === undefined) {
            return m_persistentCurrentPoint;
        }
        if (!isNaN(parseInt(persistent))) {
            persistent = parseInt(persistent);
            persistent = (!m_persistentCurrentPoint ||
                          persistent !== m_currentPoint);
        }
        persistent = !!persistent;
        if (persistent !== m_persistentCurrentPoint) {
            geoapp.activityLog.logActivity('inst_overlay_stick',
                source || 'map', {});
        }
        m_persistentCurrentPoint = persistent;
        return m_persistentCurrentPoint;
    };

    /* Show or hide the overlay based on the current point.  If the current
     * point is off the screen, show the overlay as close to that point as we
     * can.
     *
     * @param onlyMove: if true, only update the position.
     */
    this.showOverlay = function (onlyMove) {
        m_overlayTimer = null;
        var mapData = m_this.data(),
            overlay = $('#ga-instagram-overlay');
        if (m_currentPoint === null || !mapData.data ||
                m_currentPoint >= mapData.data.length) {
            if (overlay.css('display') !== 'none') {
                geoapp.activityLog.logActivity('inst_overlay_hide', 'map', {
                    url: null
                });
            }
            overlay.css('display', 'none');
            return;
        }
        var item = mapData.data[m_currentPoint];
        var mapW = $('#ga-main-map').width(),
            mapH = $('#ga-main-map').height(),
            pos = m_this.map.getMap().gcsToDisplay({
                x: item[mapData.columns.longitude],
                y: item[mapData.columns.latitude]
            }),
            offset = 10,
            url = item[mapData.columns.image_url],
            imageUrl,
            caption = item[mapData.columns.caption] || '',
            date = moment(item[mapData.columns.posted_date]).utcOffset(0
                ).format('MM-DD HH:mm');
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= mapW && pos.y <= mapH) {
            $('.ga-instagram-overlay-arrow', overlay).css('display', 'none');
        } else {
            /* Clamp position to the screen, so that the overlay is always
            /* visible.  Point an arrow to where the point is located. */
            var dx = 0, dy = 0;
            /* jscs:disable requireBlocksOnNewline */
            if (pos.x < 0) {    dx = pos.x;         pos.x = 0; }
            if (pos.x > mapW) { dx = pos.x - mapW;  pos.x = mapW; }
            if (pos.y < 0) {    dy = pos.y;         pos.y = 0; }
            if (pos.y > mapH) { dy = pos.y - mapH;  pos.y = mapH; }
            /* jscs:enable requireBlocksOnNewline */
            $('.ga-instagram-overlay-arrow', overlay).css({
                display: 'block',
                transform: 'rotate(' + Math.atan2(dy, dx).toFixed(3) + 'rad)'
            });
            offset = 0;
        }
        /* Bias very slightly to the upper right */
        var bias = 5,
            ctrX = mapW / 2 + bias,
            ctrY = mapH / 2 - bias;
        overlay.css({
            left:   pos.x < ctrX ? (pos.x + offset) + 'px' : '',
            right:  pos.x < ctrX ? '' : (mapW - pos.x + offset) + 'px',
            top:    pos.y < ctrY ? (pos.y + offset) + 'px' : '',
            bottom: pos.y < ctrY ? '' : (mapH - pos.y + offset) + 'px'
        });
        if (onlyMove) {
            return;
        }
        $('.ga-instagram-overlay-date', overlay).text(date).attr(
            'title', date);
        $('.ga-instagram-overlay-caption', overlay).text(caption).attr(
            'title', caption);
        $('.ga-instagram-overlay-link a', overlay).text(url).attr(
            'href', url);
        $('.ga-instagram-overlay-title-bar', overlay).css('display',
            m_persistentCurrentPoint ? 'block' : 'none');
        overlay.off('.instagram-overlay');
        $('*', overlay).off('.instagram-overlay');
        if (!m_persistentCurrentPoint) {
            overlay.on('mouseenter.instagram-overlay', function () {
                if (m_overlayTimer) {
                    window.clearTimeout(m_overlayTimer);
                    m_overlayTimer = null;
                }
            }).on('mouseleave.instagram-overlay', function () {
                m_overlayTimer = window.setTimeout(function () {
                    m_this.currentPoint(null, true, true);
                }, 500);
            });
        } else {
            $('.ga-instagram-overlay-goto', overlay).on(
                    'click.instagram-overlay', function () {
                m_this.map.getMap().transition({
                    center: {
                        x: item[mapData.columns.longitude],
                        y: item[mapData.columns.latitude]
                    },
                    interp: d3.interpolateZoom,
                    duration: 1000
                });
            });
            $('.ga-instagram-overlay-close-button', overlay).on(
                    'click.instagram-overlay', function () {
                m_this.currentPoint(null, true, true);
            });
        }
        imageUrl = url.replace(/\/$/, '') + '/media?size=m';
        if ($('img', overlay).attr('orig_url') !== url) {
            overlay.css('display', 'none');
            $('.ga-instagram-overlay-image', overlay).css('display', 'none');
            $('img', overlay).off('.instagram-overlay'
            ).on('load.instagram-overlay', function () {
                $('.ga-instagram-overlay-image', overlay).css('display', '');
                overlay.css('display', 'block');
                geoapp.activityLog.logActivity('inst_overlay', 'map', {
                    source: m_currentPointSource || '',
                    imageUrl: imageUrl,
                    url: url
                });
            }).on('error.instagram-overlay', function () {
                overlay.css('display', 'block');
                geoapp.activityLog.logActivity('inst_overlay', 'map', {
                    source: m_currentPointSource || '',
                    url: url
                });
            }).attr({src: imageUrl, orig_url: url});
        } else {
            overlay.css('display', 'block');
        }
    };
};

inherit(geoapp.mapLayers.instagram, geoapp.MapLayer);
