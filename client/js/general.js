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

/* General use functions that don't belong to a more specific code block. */

/* Check if the scroll is near the bottom of a scrollable element.  If so, call
 * to get more data.
 *
 * @param selector: a jquery selector for the scrollable element.  Its sole
 *                  child should be the scrollable data and have an outHeight
 *                  that is the size of the whole data.
 * @param loadFunc: the function to call to populate the scrollable child with
 *                  more data.  Returns truthy if more data is available, falsy
 *                  if all data is loaded.
 */
function infiniteScrollHandler(selector, loadFunc) {
    var liveZone = 300;

    var elem = $(selector),
        scrollTop = elem.scrollTop(),
        containerSize = elem.innerHeight(),
        dataSize = elem.children().outerHeight(true);
    if (scrollTop + containerSize + liveZone >= dataSize) {
        if (!loadFunc.call(this)) {
            elem.off('scroll.ga-infinite');
        }
    }
}

/* Attach a scroll handler to an element.  When its immediate children are
 * scrolled such that a small number of pixels are left near the bottom, a
 * callback function is called to attempt to load more data.  If the callback
 * returns false, no more data is expected.
 *
 * @param selector: a jquery selector for the scrollable element.  Its sole
 *                  child should be the scrollable data and have an outHeight
 *                  that is the size of the whole data.
 * @param loadFunc: the function to call to populate the scrollable child with
 *                  more data.  Returns truthy if more data is available, falsy
 *                  if all data is loaded.
 * @param context: context for the loadFunc.
 */
function infiniteScroll(selector, loadFunc, context) {
    var elem = $(selector);

    elem.off('scroll.ga-infinite');
    elem.on('scroll.ga-infinite', _.bind(
        infiniteScrollHandler, context || this, selector, loadFunc));
}