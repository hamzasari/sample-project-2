// @ts-check

import { APIWrapper, API_EVENT_TYPE } from "./api.js";
import { addMessage, animateGift, isPossiblyAnimatingGift, isAnimatingGiftUI } from "./dom_updates.js";

const api = new APIWrapper();

let eventQueue = [];

api.setEventHandler((events) => {

  if (events.length > 0) {
    // I used sortEvents method here to prioritize animated gifts over other types and after prioritizing I added them to message queue.
    // Because, I understand from the document that every received event block has to evaluate on its own.
    // If animated gifts are always wanted to be first elements in message queue then we have to sort eventQueue in every 500 milliseconds,
    // but it is not efficient and I didn't get it from the document.
    eventQueue.push(...sortEvents(events));

    // Handle duplicates
    removeDuplicateEvents();
  }

})

// NOTE: UI helper methods from `dom_updates` are already imported above.

/**
 * Removes duplicate events from event queue
 */
const removeDuplicateEvents = () => {
  eventQueue = Array.from(new Set(eventQueue.map(item => item.id)))
    .map(id => {
      return eventQueue.find(item => item.id === id)
    });
};

/**
 * Removes events with type "Message" older than 20 seconds
 */
const removeEventsWithTypeMessageOlderThan20Seconds = () => {
  eventQueue = eventQueue.filter((event) => {
    if (event.type === API_EVENT_TYPE.MESSAGE) {
      const differenceInMilliseconds = new Date().getTime() - new Date(event.timestamp).getTime();
      const differenceInSeconds = differenceInMilliseconds / 1000;
      if (differenceInSeconds <= 20) {
        return event;
      }
    } else {
      return event;
    }
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
 * Checks event queue and makes necessary dom updates if event queue has any element and removes that element from event queue
 */
const checkEventQueueAndMakeNecessaryDomUpdate = () => {
  if (eventQueue.length <= 0) {
    return;
  }

  removeEventsWithTypeMessageOlderThan20Seconds();

  let currentEvent = null;

  if (eventQueue[0].type === API_EVENT_TYPE.ANIMATED_GIFT) {
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
  } else {
    currentEvent = eventQueue.shift();
    addMessage(currentEvent);
  }
};

// UI update interval is 500 milliseconds
setInterval(() => {
  checkEventQueueAndMakeNecessaryDomUpdate();
}, 500);
