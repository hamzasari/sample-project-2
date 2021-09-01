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
    eventQueue.push(...sortEvents(events));

    // Handle duplicates
    removeDuplicateEvents();

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
 */
const removeDuplicateEvents = () => {
  eventQueue = Array.from(new Set(eventQueue.map(item => item.id)))
    .map(id => {
      return eventQueue.find(item => item.id === id)
    });
};

/**
 * Returns prioritized event array
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
 * @param timestamp
 * @returns {number}
 */
const calculateTimeDifferenceInSecondsAccordingToNow = (timestamp) => {
  const differenceInMilliseconds = new Date().getTime() - new Date(timestamp).getTime();
  return differenceInMilliseconds / 1000;
};

/**
 * Ignores first event with type message older than 20 seconds and controls for other elements in order
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
 * Checks event queue and makes necessary dom updates if event queue has any element and removes that element from event queue
 */
const checkEventQueueAndMakeNecessaryDomUpdate = () => {
  // Check length of event queue, if it is empty stop global interval
  if (eventQueue.length <= 0) {
    clearInterval(globalInterval);
    globalInterval = null;
    return;
  }

  // ignore first item if type is message and it is older than 20 seconds
  ignoreFirstEventWithTypeMessageOlderThan20Seconds();

  let currentEvent = null;

  if (eventQueue[0].type === API_EVENT_TYPE.ANIMATED_GIFT) { // if current event is an animated gift
    if (!isAnimatingGiftUI() && !isPossiblyAnimatingGift()) { // if there is no animating gift that is currently playing
      currentEvent = eventQueue.shift();
      addMessage(currentEvent);
      animateGift(currentEvent);
    } else { // if there is an animating gift that is currently playing
      // find first not animating gift index
      const index = getFirstNotAnimatedGiftEventIndex();
      // remove it from event queue and add it to messages
      if (index !== -1) {
        currentEvent = eventQueue.splice(index, 1)[0];
        addMessage(currentEvent);
      }
    }
  } else { // if current event is not an animated gift
    currentEvent = eventQueue.shift();
    addMessage(currentEvent);
  }
};
