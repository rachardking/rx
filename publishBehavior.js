export function publishBehavior<T>(value: T):  UnaryFunction<Observable<T>, ConnectableObservable<T>> {
  return (source: Observable<T>) => multicast(new BehaviorSubject<T>(value))(source) as ConnectableObservable<T>;
}


export function multicast<T, R>(subjectOrSubjectFactory: Subject<T> | (() => Subject<T>),
                                selector?: (source: Observable<T>) => Observable<R>): OperatorFunction<T, R> {
  return function multicastOperatorFunction(source: Observable<T>): Observable<R> {
    let subjectFactory: () => Subject<T>;
    if (typeof subjectOrSubjectFactory === 'function') {
      subjectFactory = <() => Subject<T>>subjectOrSubjectFactory;
    } else {
      subjectFactory = function subjectFactory() {
        return <Subject<T>>subjectOrSubjectFactory;
      };
    }

    if (typeof selector === 'function') {
      return source.lift(new MulticastOperator(subjectFactory, selector));
    }

    const connectable: any = Object.create(source, connectableObservableDescriptor);
    connectable.source = source;
    connectable.subjectFactory = subjectFactory;

    return <ConnectableObservable<R>> connectable;
  };
}

export class MulticastOperator<T, R> implements Operator<T, R> {
  constructor(private subjectFactory: () => Subject<T>,
              private selector: (source: Observable<T>) => Observable<R>) {
  }
  call(subscriber: Subscriber<R>, source: any): any {
    const { selector } = this;
    const subject = this.subjectFactory();
    const subscription = selector(subject).subscribe(subscriber);
    subscription.add(source.subscribe(subject));
    return subscription;
  }
}
