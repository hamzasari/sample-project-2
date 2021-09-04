// @ts-check

import { APIWrapper, API_EVENT_TYPE } from "./api.js";
import { addMessage, animateGift, isPossiblyAnimatingGift, isAnimatingGiftUI } from "./dom_updates.js";

const api = new APIWrapper();

const defaultIntervalTimeout = 500;
let globalInterval = null;
let eventQueue = [];

api.setEventHandler((events) => {

  if (events.length > 0) {
    // I used sortEvents method here to prioritize animated gifts over other types and after prioritizing I added them to the event queue.
    // Because, I understand from the document that every received event block has to evaluate on its own.
    // If animated gifts are always wanted to be first elements in the event queue then we have to sort eventQueue if new events come,
    // but it is not efficient and I didn't get it from the document.
    // If we want to sort eventQueue to prioritize the animated gifts in eventQueue when new events are added to it,
    // then we can change line 22 to -> eventQueue.push(...events);
    // and on line 23 add -> eventQueue = sortEvents(eventQueue);
    eventQueue.push(...sortEvents(events));

    // Handle duplicates
    // I remove duplicate events from eventQueue when new events are came
    removeDuplicateEvents();

    // I stopped global interval in checkEventQueueAndMakeNecessaryDomUpdate method if there is no event on eventQueue
    // if there is new event on eventQueue this code block restarts global interval
    // it is not necessary to run a thread every 500 milliseconds if there is no event in event queue,
    // maybe there won't be any event in event queue for 5 hours and if we don't stop global interval, we will have an unnecessary thread that works every 500 seconds
    if (!globalInterval) {
      // UI update interval is 500 milliseconds
      globalInterval = setInterval(() => {
        checkEventQueueAndMakeNecessaryDomUpdate();
      }, defaultIntervalTimeout);
    }
  }

});

// NOTE: UI helper methods from `dom_updates` are already imported above.

/**
 * Removes duplicate events by id from event queue
 *
 * I used a set to remove duplicate items according to their id property
 *
 * map operation in new Set() will work on O(n) time complexity
 * converting it to array with Array.from will work on O(n) time complexity
 * other map and find will also work on O(n) time complexity
 * at the and we will have O(n*4) which leads us to O(n) time complexity for this function
 */
const removeDuplicateEvents = () => {
  eventQueue = Array.from(new Set(eventQueue.map(item => item.id)))
    .map(id => {
      return eventQueue.find(item => item.id === id)
    });
};

/**
 * Returns prioritized event array
 *
 * I used 2 other arrays for making operation fast
 * With this approach I sacrificed space complexity, but sortEvent method will work on O(n + n) -> O(n) time complexity according to BigO notation
 *
 * @param events
 * @returns {APIMessageEventData[]}
 */
const sortEvents = (events) => {
  const animatedGiftEvents = events.filter((event) => {
    if (event.type === API_EVENT_TYPE.ANIMATED_GIFT) {
      return event;
    }
  });
  const otherEvents = events.filter((event) => {
    if (event.type !== API_EVENT_TYPE.ANIMATED_GIFT) {
      return event;
    }
  });
  return [...animatedGiftEvents, ...otherEvents];
};

/**
 * Returns first event index in event queue that is not an animated gift event
 *
 * This method runs on O(n) for the worst case according to BigO notation
 *
 * @returns {number}
 */
const getFirstNotAnimatedGiftEventIndex = () => {
  for (let i = 0; i < eventQueue.length; i++) {
    if (eventQueue[i].type !== API_EVENT_TYPE.ANIMATED_GIFT) {
      return i;
    }
  }

  return -1;
};

/**
 * Calculates time difference in seconds according to now
 *
 * Time complexity: O(1)
 *
 * @param timestamp
 * @returns {number}
 */
const calculateTimeDifferenceInSecondsAccordingToNow = (timestamp) => {
  const differenceInMilliseconds = new Date().getTime() - new Date(timestamp).getTime();
  return differenceInMilliseconds / 1000;
};

/**
 * Ignores first event with type message older than 20 seconds and controls for other elements in order
 *
 * In every 500 milliseconds this method will be called and I check for first element if it is a Message event
 * if so, I will check the time difference between now and timestamp of this event
 * if difference is greater than 20 seconds than I ignore it and delete it from the eventQueue, then check for next event with loop
 * if difference is lower than or equal to 20 seconds than I break the loop and return from this function
 *
 * if first event is not a Message event, then I will do nothing in this function and return from it
 *
 * This method works on O(n) time complexity for worst case according to BigO notation
 * It runs on O(1) most of the time
 *
 * I used filtering on eventQueue at first, but that approach will be very slow when working with very big eventQueue
 * With this approach it will work very fast and always work with same time complexity if we even have one million or more items in event queue, this will important for scalability
 */
const ignoreFirstEventWithTypeMessageOlderThan20Seconds = () => {
  // work only if current element type is message
  while (eventQueue[0].type === API_EVENT_TYPE.MESSAGE) {
    const differenceInSeconds = calculateTimeDifferenceInSecondsAccordingToNow(eventQueue[0].timestamp);
    if (differenceInSeconds > 20) {
      // if current element is message and it is older than 20 seconds than ignore it
      eventQueue.shift();
    } else {
      // otherwise break the loop
      break;
    }
  }
}

/**
 * Processes normal event for the first item in the eventQueue,
 * This method can be called if the first event in the eventQueue is Message or Gift
 *
 * Time complexity: O(1)
 */
function processNormalEvent() {
  addMessage(eventQueue.shift());
}

/**
 * Returns true if there is no animating gift is still playing, otherwise return false
 *
 * Time complexity: O(1)
 *
 * @returns {boolean}
 */
function isAnyAnimatingGiftNotPlaying() {
  return !isAnimatingGiftUI() && !isPossiblyAnimatingGift();
}

/**
 * Processes animated gift event with given dom_updates functions
 * This method can be called if the first event in the eventQueue is an Animated Gift
 *
 * Time complexity: O(1)
 */
function processAnimatedGiftEvent() {
  const currentEvent = eventQueue.shift();
  addMessage(currentEvent);
  animateGift(currentEvent);
}

/**
 * This method will be used if there is an animated gift is still playing
 * This method will get the first event that is not an animated gift event and process that event
 *
 * Time complexity: O(n) for the worst case
 */
function processFirstNotAnimatedGiftEvent() {
  // find first not animating gift index
  const index = getFirstNotAnimatedGiftEventIndex();
  // remove it from event queue and add it to messages
  if (index !== -1) {
    addMessage(eventQueue.splice(index, 1)[0]);
  }
}

/**
 * Stops the global interval and sets null as its value to mark the interval object to be cleared with garbage collection,
 * js uses mark and sweep technique for garbage collection process
 *
 * Time complexity: O(1)
 */
function stopGlobalInterval() {
  clearInterval(globalInterval);
  globalInterval = null;
}

/**
 * Returns true if the first event in the queue is an animated gift
 *
 * Time complexity: O(1)
 *
 * @returns {boolean}
 */
function isFirstEventInQueueAnAnimatedGift() {
  return eventQueue[0].type === API_EVENT_TYPE.ANIMATED_GIFT;
}

/**
 * Main function that works with globalInterval,
 * It checks event queue and makes necessary dom updates if event queue has any element and removes that element from event queue
 *
 * Time complexity: O(n) for the worst case
 */
const checkEventQueueAndMakeNecessaryDomUpdate = () => {
  // Check length of event queue, if it is empty stop global interval
  if (eventQueue.length <= 0) {
    stopGlobalInterval();
    return false;
  }

  // ignore first item if type is message and it is older than 20 seconds (method usage is explained in its own jsdoc)
  ignoreFirstEventWithTypeMessageOlderThan20Seconds();

  if (isFirstEventInQueueAnAnimatedGift()) { // if current event is an animated gift
    if (isAnyAnimatingGiftNotPlaying()) { // if there is no animating gift that is currently playing
      processAnimatedGiftEvent();
    } else { // if there is an animating gift that is currently playing
      processFirstNotAnimatedGiftEvent();
    }
    return true;
  }

  // if current event is not an animated gift
  processNormalEvent();
  return true;
};
