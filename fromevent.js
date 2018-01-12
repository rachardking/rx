import { Observable } from '../Observable';
import { tryCatch } from '../util/tryCatch';
import { isFunction } from '../util/isFunction';
import { errorObject } from '../util/errorObject';
import { Subscription } from '../Subscription';
import { Subscriber } from '../Subscriber';

const toString: Function = Object.prototype.toString;

export type NodeStyleEventEmitter = {
  addListener: (eventName: string, handler: Function) => void;
  removeListener: (eventName: string, handler: Function) => void;
};
function isNodeStyleEventEmitter(sourceObj: any): sourceObj is NodeStyleEventEmitter {
  return !!sourceObj && typeof sourceObj.addListener === 'function' && typeof sourceObj.removeListener === 'function';
}

export type JQueryStyleEventEmitter = {
  on: (eventName: string, handler: Function) => void;
  off: (eventName: string, handler: Function) => void;
};
function isJQueryStyleEventEmitter(sourceObj: any): sourceObj is JQueryStyleEventEmitter {
  return !!sourceObj && typeof sourceObj.on === 'function' && typeof sourceObj.off === 'function';
}

function isNodeList(sourceObj: any): sourceObj is NodeList {
  return !!sourceObj && toString.call(sourceObj) === '[object NodeList]';
}

function isHTMLCollection(sourceObj: any): sourceObj is HTMLCollection {
  return !!sourceObj && toString.call(sourceObj) === '[object HTMLCollection]';
}

function isEventTarget(sourceObj: any): sourceObj is EventTarget {
  return !!sourceObj && typeof sourceObj.addEventListener === 'function' && typeof sourceObj.removeEventListener === 'function';
}

export type EventTargetLike = EventTarget | NodeStyleEventEmitter | JQueryStyleEventEmitter | NodeList | HTMLCollection;

export type EventListenerOptions = {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
} | boolean;

export type SelectorMethodSignature<T> = (...args: Array<any>) => T;

/**
 * We need this JSDoc comment for affecting ESDoc.
 * @extends {Ignored}
 * @hide true
 */
export class FromEventObservable<T> extends Observable<T> {

  /* tslint:disable:max-line-length */
  static create<T>(target: EventTargetLike, eventName: string): Observable<T>;
  static create<T>(target: EventTargetLike, eventName: string, selector: SelectorMethodSignature<T>): Observable<T>;
  static create<T>(target: EventTargetLike, eventName: string, options: EventListenerOptions): Observable<T>;
  static create<T>(target: EventTargetLike, eventName: string, options: EventListenerOptions, selector: SelectorMethodSignature<T>): Observable<T>;
  /* tslint:enable:max-line-length */

  static create<T>(target: EventTargetLike,
                   eventName: string,
                   options?: EventListenerOptions | SelectorMethodSignature<T>,
                   selector?: SelectorMethodSignature<T>): Observable<T> {
    if (isFunction(options)) {
      selector = <any>options;
      options = undefined;
    }
    return new FromEventObservable(target, eventName, selector, options as EventListenerOptions | undefined);
  }

  constructor(private sourceObj: EventTargetLike,
              private eventName: string,
              private selector?: SelectorMethodSignature<T>,
              private options?: EventListenerOptions) {
    super();
  }

  private static setupSubscription<T>(sourceObj: EventTargetLike,
                                      eventName: string,
                                      handler: Function,
                                      subscriber: Subscriber<T>,
                                      options?: EventListenerOptions) {
    let unsubscribe: () => void;
    if (isNodeList(sourceObj) || isHTMLCollection(sourceObj)) {
      for (let i = 0, len = sourceObj.length; i < len; i++) {
        FromEventObservable.setupSubscription(sourceObj[i], eventName, handler, subscriber, options);
      }
    } else if (isEventTarget(sourceObj)) {
      const source = sourceObj;
      sourceObj.addEventListener(eventName, <EventListener>handler, <boolean>options);
      unsubscribe = () => source.removeEventListener(eventName, <EventListener>handler);
    } else if (isJQueryStyleEventEmitter(sourceObj)) {
      const source = sourceObj;
      sourceObj.on(eventName, handler);
      unsubscribe = () => source.off(eventName, handler);
    } else if (isNodeStyleEventEmitter(sourceObj)) {
      const source = sourceObj;
      sourceObj.addListener(eventName, handler);
      unsubscribe = () => source.removeListener(eventName, handler);
    } else {
      throw new TypeError('Invalid event target');
    }

    subscriber.add(new Subscription(unsubscribe));
  }

  protected _subscribe(subscriber: Subscriber<T>) {
    const sourceObj = this.sourceObj;
    const eventName = this.eventName;
    const options = this.options;
    const selector = this.selector;
    let handler = selector ? (...args: any[]) => {
      let result = tryCatch(selector)(...args);
      if (result === errorObject) {
        subscriber.error(errorObject.e);
      } else {
        subscriber.next(result);
      }
    } : (e: any) => subscriber.next(e);

    FromEventObservable.setupSubscription(sourceObj, eventName, handler, subscriber, options);
  }
}
