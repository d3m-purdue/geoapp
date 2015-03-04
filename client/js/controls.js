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

geoapp.views.ControlsView = geoapp.View.extend({
    events: {
        'click #ga-controls-filter': function () {
            this.updateView(true, 'filter');
        },
        'click #ga-anim-update': function () {
            if ($('#ga-play').val() === 'stop') {
                $('#ga-play').val('play');
            }
            this.updateView(true, 'anim');
        },
        'change #ga-display-settings select': function () {
            this.updateView(true, 'display');
        },
        'click #ga-play': function () {
            this.animationAction('playpause');
        },
        'click #ga-anim-step-back': function () {
            this.animationAction('stepback');
        },
        'click #ga-anim-step': function () {
            this.animationAction('step');
        },
        'click #ga-anim-stop': function () {
            this.animationAction('stop');
        },
        'slide #ga-step-slider': function (evt) {
            this.animationAction('jump', evt.value);
        },
        'slideStart #ga-step-slider': function (evt) {
            this.animationAction('jump', evt.value);
        },
        'slideStop #ga-step-slider': function (evt) {
            this.animationAction('jump', evt.value);
        }
    },

    /* Initialize the view.
     *
     * @params settings: the initial settings.  This can include defaults for
     *                   the different control groups.
     */
    initialize: function (settings) {
        this.initialSettings = settings;
        girder.cancelRestRequests('fetch');
        this.firstRender = true;
        this.render();
    },

    /* Render the view.  This also prepares various controls if this is the
     * first load.
     */
    render: function () {
        var view = this;
        var ctls = this.$el.html(geoapp.templates.controls(
        )).on('ready.geoapp.view', function () {
            update = false;
            if (view.initialSettings && !view.usedInitialSettings) {
                settings = view.initialSettings;
                view.usedInitialSettings = true;
                var sections = {
                    filter: '#ga-filter-settings #',
                    display: '#ga-display-settings #',
                    anim: '#ga-anim-settings #'
                };
                _.each(sections, function (baseSelector, section) {
                    if (settings[section]) {
                        params = geoapp.parseQueryString(settings[section]);
                        _.each(params, function (value, id) {
                            try {
                                if (value !== '' && value !== undefined) {
                                    $(baseSelector + id).val(value);
                                    update = true;
                                }
                            } catch (err) { }
                        });
                    }
                });
            }
            $('#ga-filter-settings .ga-date-range').each(function () {
                var elem = $(this);
                var params = {};
                view.getDateRange(elem, params, 'date');
                elem.daterangepicker({
                    timePicker: true,
                    startDate: (params.date_min || params.date ||
                                '2013-01-01 00:00'),
                    endDate: (params.date_max || params.date ||
                              '2014-01-01 00:00'),
                    format: 'YYYY-MM-DD HH:mm',
                    timePicker12Hour: false,
                    timePickerIncrement: 5
                });
            });
            $('[title]').tooltip();
            $('#ga-step-slider').slider({
                formatter: geoapp.map.getStepDescription
            }).slider('disable');
            if (view.firstRender) {
                view.firstRender = false;
                geoapp.map.showMap([], view.updateSection('display', false));
            }
            if (update) {
                view.updateView(false);
            }
        });
        ctls.trigger($.Event('ready.geoapp.view', {relatedTarget: ctls}));
        return this;
    },

    /* Get a range from a date range control.  The ranges are of the form
     * YYYY-MM-DD hh:mm:ss - YYYY-MM-DD hh:mm:ss .  Everything is optional.
     * The ranges must be separated by the string ' - '.
     *
     * @param selector: selector for input control.
     * @param params: dictionary in which to store result.
     * @param baseKey: baseKey for which to store the value.  If there is no
     *                 range separator, this is assumed to be a singular
     *                 entry.
     */
    getDateRange: function (selector, params, baseKey) {
        var val = $(selector).val().trim();
        if (val === '') {
            return;
        }
        var parts = val.split(' - ');
        if (parts.length === 1) {
            params[baseKey] = val;
            return;
        }
        if (parts[0].trim() !== '') {
            params[baseKey + '_min'] = parts[0].trim();
        }
        if (parts[1].trim() !== '') {
            params[baseKey + '_max'] = parts[1].trim();
        }
    },

    /* Get a floating-point range from a control.  The ranges are of the form
     * (min value) - (max value).  Everything is optional.  The ranges must be
     * separated by the string '-'.
     *
     * @param selector: selector for input control.
     * @param params: dictionary in which to store result.
     * @param baseKey: baseKey for which to store the value.  If there is no
     *                 range separator, this is assumed to be a singular
     *                 entry.
     */
    getFloatRange: function (selector, params, baseKey) {
        var val = $(selector).val().trim();
        if (val === '') {
            return;
        }
        var parts = val.split('-');
        if (parts.length === 1) {
            if (!isNaN(parseFloat(val))) {
                params[baseKey] = parseFloat(val);
            }
            return;
        }
        if (parts[0].trim() !== '') {
            val = parseFloat(parts[0].trim());
            if (!isNaN(val)) {
                params[baseKey + '_min'] = val;
            }
        }
        if (parts[1].trim() !== '') {
            val = parseFloat(parts[1].trim());
            if (!isNaN(val)) {
                params[baseKey + '_max'] = val;
            }
        }
    },

    /* Get an integer range from a control.  The ranges are of the form
     * (min value) - (max value).  Everything is optional.  The ranges must be
     * separated by the string '-'.
     *
     * @param selector: selector for input control.
     * @param params: dictionary in which to store result.
     * @param baseKey: baseKey for which to store the value.  If there is no
     *                 range separator, this is assumed to be a singular
     *                 entry.
     */
    getIntRange: function (selector, params, baseKey) {
        var val = $(selector).val().trim();
        if (val === '') {
            return;
        }
        var parts = val.split('-');
        if (parts.length === 1) {
            if (!isNaN(parseInt(val))) {
                params[baseKey] = parseInt(val);
            }
            return;
        }
        if (parts[0].trim() !== '') {
            val = parseInt(parts[0].trim());
            if (!isNaN(val)) {
                params[baseKey + '_min'] = val;
            }
        }
        if (parts[1].trim() !== '') {
            val = parseInt(parts[1].trim());
            if (!isNaN(val)) {
                params[baseKey + '_max'] = val;
            }
        }
    },

    /* Update some portion of the view.  This parses the specified section,
     * and, if appropriate, updates the map or other details.
     *
     * @param updateNav: true to update the navigation route.
     * @param updateSection: the section to update.  If not specified, update
     *                       all sections.
     */
    updateView: function (updateNav, updateSection) {
        var results = {};
        if (!updateSection || updateSection === 'filter') {
            results.filter = this.updateSection('filter', updateNav);
        }
        if (!updateSection || updateSection === 'display') {
            results.display = this.updateSection('display', updateNav);
        }
        if (!updateSection || updateSection === 'anim') {
            results.anim = this.updateAnimValues(updateNav);
        }
        if (results.filter) {
            if (!results.display) {
                results.display = this.updateSection('filter', false);
            }
            geoapp.map.replaceMapData(
                {params: results.filter, display: results.display});
        } else if (results.display) {
            geoapp.map.updateMapParams(results.display);
        }
        if (results.anim) {
            geoapp.map.updateMapAnimation(results.anim);
        }
    },

    /* Update values associated with a section of the controls.
     *
     * @param section: the name of the section to update.  One of 'filter',
     *                 'anim', or 'display'.
     * @param updateNav: true to update the navigation route.
     * @return: the new map filter parameters.
     */
    updateSection: function (section, updateNav) {
        var view = this;
        var selector = 'ga-' + section + '-settings';
        var params = {};
        var navFields = {};
        $('#' + selector + ' [taxifield]').each(function () {
            var elem = $(this);
            var value = elem.val();
            if (value !== '') {
                navFields[elem.attr('id')] = value;
            }
            view.getTaxiValue(elem, params);
        });
        if (updateNav) {
            geoapp.updateNavigation('mapview', section, navFields);
        }
        return params;
    },

    /* Update values associated with the animation controls.
     *
     * @param updateNav: true to update the navigation route.
     * @return: the new animation parameters.
     */
    updateAnimValues: function (updateNav, results) {
        var params = this.updateSection('anim', updateNav);
        params.statusElem = '#ga-cycle-anim';
        params.sliderElem = '#ga-step-slider';
        return params;
    },

    /* Get an value or range of values from a control.  The type is stored in
     * elem.attr('taxitype') and the key is stored in elem.attr('taxifield').
     *
     * @param selector: selector for input control.
     * @param params: dictionary in which to store result.
     */
    getTaxiValue: function (selector, params) {
        var elem = $(selector);
        var value = elem.val();
        var field = elem.attr('taxifield');
        if (!field) {
            return;
        }
        var ttype = elem.attr('taxitype');
        switch (ttype) {
            case 'dateRange':
                this.getDateRange(elem, params, field);
                break;
            case 'floatRange':
                this.getFloatRange(elem, params, field);
                break;
            case 'intRange':
                this.getIntRange(elem, params, field);
                break;
            default:
                if (value !== null && value !== undefined && value.length > 0) {
                    params[field] = elem.val();
                }
                break;
        }
    },

    /* Perform an action on the animation.  Available actions are
     *  jump: go to the specified stepnum, maintaining the current play or
     *      paused state.
     *  playpause: toggles between playing and paused state.
     *  step: goes to the pause state.  If in the paused state, advance one
     *      frame.
     *  stepback: goes to the pause state.  If in the paused state, rewind one
     *      frame.
     *  stop: resets to no-animation state.
     *
     * @param action: one of the actions listed above.
     * @param stepnum: the explicit step to go to, if specified.
     */
    animationAction: function (action, stepnum) {
        var playState = action, step;

        if (stepnum !== undefined) {
            step = geoapp.map.animationAction('jump', stepnum);
            playState = $('#ga-play').val();
            if ($('#ga-play').val() !== 'play') {
                if (step !== undefined) {
                    playState = 'step' + step;
                }
            }
            action = 'none';
        }
        switch (action) {
            case 'playpause':
                if ($('#ga-play').val() !== 'play') {
                    playState = 'play';
                    geoapp.map.animationAction('play');
                    break;
                }
                /* intentionally fall through to 'step' */
                /* jshint -W086 */
            case 'step':
                step = geoapp.map.animationAction('step');
                if (step !== undefined) {
                    playState = 'step' + step;
                }
                break;
            case 'stepback':
                step = geoapp.map.animationAction('stepback');
                if (step !== undefined) {
                    playState = 'step' + step;
                }
                break;
            case 'stop':
                $('#ga-cycle-anim').text('Full Data');
                geoapp.map.animationAction('stop');
                break;
        }
        $('#ga-play').val(playState);
        geoapp.updateNavigation(
            'mapview', 'anim', {'ga-play': playState}, true);
    }
});

/* Given an appropriate route, redirect to the ControlsView.
 *
 * @params params: query parameters specified as part of the route.
 */
function routeToControls(params) {
    geoapp.events.trigger(
        'ga:navigateTo', geoapp.views.ControlsView, _.extend({
        }, params || {}));
}

geoapp.router.route('', 'mapview', routeToControls);
geoapp.router.route('mapview', 'mapview', routeToControls);
