import { isFunction } from './util/isFunction';
import { Observer, PartialObserver } from './Observer';
import { Subscription } from './Subscription';
import { empty as emptyObserver } from './Observer';
import { rxSubscriber as rxSubscriberSymbol } from './symbol/rxSubscriber';


export class Subscriber<T> extends Subscription implements Observer<T> {

  [rxSubscriberSymbol]() { return this; }


  static create<T>(next?: (x?: T) => void,
                   error?: (e?: any) => void,
                   complete?: () => void): Subscriber<T> {
    const subscriber = new Subscriber(next, error, complete);
    return subscriber;
  }

  protected isStopped: boolean = false;
  protected destination: PartialObserver<any>; // this `any` is the escape hatch to erase extra type param (e.g. R)

  constructor(destinationOrNext?: PartialObserver<any> | ((value: T) => void),
              error?: (e?: any) => void,
              complete?: () => void) {
    super();

    switch (arguments.length) {
      case 0:
        this.destination = emptyObserver;
        break;
      case 1:
        if (!destinationOrNext) {
          this.destination = emptyObserver;
          break;
        }
        if (typeof destinationOrNext === 'object') {
          if (destinationOrNext instanceof Subscriber) {
            this.destination = (<Subscriber<any>> destinationOrNext);
            (<any> this.destination).add(this);
          } else {
            this.destination = new SafeSubscriber<T>(<PartialObserver<any>> destinationOrNext);
          }
          break;
        }
      default:
        this.destination = new SafeSubscriber<T>(<((value: T) => void)> destinationOrNext, error, complete);
        break;
    }
  }

  next(value?: T): void {
    if (!this.isStopped) {
      this._next(value);
    }
  }

 
  error(err?: any): void {
    if (!this.isStopped) {
      this.isStopped = true;
      this._error(err);
    }
  }

 
  complete(): void {
    if (!this.isStopped) {
      this.isStopped = true;
      this._complete();
    }
  }

  unsubscribe(): void {
    if (this.closed) {
      return;
    }
    this.isStopped = true;
    super.unsubscribe();
  }

  protected _next(value: T): void {
    this.destination.next(value);
  }

  protected _error(err: any): void {
    this.destination.error(err);
    this.unsubscribe();
  }

  protected _complete(): void {
    this.destination.complete();
    this.unsubscribe();
  }

  protected _unsubscribeAndRecycle(): Subscriber<T> {
    const { _parent, _parents } = this;
    this._parent = null;
    this._parents = null;
    this.unsubscribe();
    this.closed = false;
    this.isStopped = false;
    this._parent = _parent;
    this._parents = _parents;
    return this;
  }
}

/**
 * We need this JSDoc comment for affecting ESDoc.
 * @ignore
 * @extends {Ignored}
 */
class SafeSubscriber<T> extends Subscriber<T> {

  private _context: any;

  constructor(observerOrNext?: PartialObserver<T> | ((value: T) => void),
              error?: (e?: any) => void,
              complete?: () => void) {
    super();

    let next: ((value: T) => void);
    let context: any = this;

    if (isFunction(observerOrNext)) {
      next = (<((value: T) => void)> observerOrNext);
    } else if (observerOrNext) {
      next = (<PartialObserver<T>> observerOrNext).next;
      error = (<PartialObserver<T>> observerOrNext).error;
      complete = (<PartialObserver<T>> observerOrNext).complete;
      if (observerOrNext !== emptyObserver) {
        context = Object.create(observerOrNext);
        if (isFunction(context.unsubscribe)) {
          this.add(<() => void> context.unsubscribe.bind(context));
        }
        context.unsubscribe = this.unsubscribe.bind(this);
      }
    }

    this._context = context;
    this._next = next;
    this._error = error;
    this._complete = complete;
  }

  next(value?: T): void {
    if (!this.isStopped && this._next) {
      try {
        this._next.call(this._context, value);
      } catch (err) {
        this._hostReportError(err);
        this.unsubscribe();
      }
    }
  }

  error(err?: any): void {
    if (!this.isStopped) {
      if (this._error) {
        try {
          this._error.call(this._context, err);
        } catch (err) {
          this._hostReportError(err);
        }
      } else {
        this._hostReportError(err);
      }
      this.unsubscribe();
    }
  }

  complete(): void {
    if (!this.isStopped) {
      if (this._complete) {
        try {
          this._complete.call(this._context);
        } catch (err) {
          this._hostReportError(err);
        }
      }
      this.unsubscribe();
    }
  }

  protected _unsubscribe(): void {
    this._context = null;
  }

  private _hostReportError(err: any) {
    setTimeout(() => { throw err; });
  }
}
