console.clear()
// 預設空的 observer 
const emptyObserver = {
  next: () => {},
  error: (err) => { throw err; },
  complete: () => {}
}

class Observer {
  constructor(destinationOrNext, error, complete) {
    switch (arguments.length) {
      case 0:
        // 空的 observer
        this.destination = this.safeObserver(emptyObserver);
        break;
      case 1:
        if (!destinationOrNext) {
          // 空的 observer
          this.destination = this.safeObserver(emptyObserver);
          break;
        }
        // 多一個判斷，是否傳入的 destinationOrNext 原本就是 Observer 的實例，如果是就不用在用執行 `this.safeObserver`
        if(destinationOrNext instanceof Observer){
          this.destination = destinationOrNext;
          break;
        }
        if (typeof destinationOrNext === 'object') {
          // 傳入了 observer 物件
          this.destination = this.safeObserver(destinationOrNext);
          break;
        }
      default:
        // 如果上面都不是，代表應該是傳入了一到三個 function
        this.destination = this.safeObserver(destinationOrNext, error, complete);
        break;
    }
  }
  safeObserver(observerOrNext, error, complete) {
    let next;

    if (typeof (observerOrNext) === 'function') {
      // observerOrNext 是 next function
      next = observerOrNext;
    } else if (observerOrNext) {
      // observerOrNext 是 observer 物件
      next = observerOrNext.next || () => {};
      error = observerOrNext.error || function(err) { 
        throw err 
      };
      complete = observerOrNext.complete || () => {};
    }
    // 最後回傳我們預期的 observer 物件
    return {
      next: next,
      error: error,
      complete: complete
    };
  }
  
  next(value) {
    if (!this.isStopped && this.next) {
      // 先判斷是否停止過
      try {
        this.destination.next(value); // 傳送值
      } catch (err) {
        this.unsubscribe();
        throw err;
      }
    }
  }
  
  error(err) {
    if (!this.isStopped && this.error) {
      // 先判斷是否停止過
      try {
        this.destination.error(err); // 傳送錯誤
      } catch (anotherError) {
        this.unsubscribe();
        throw anotherError;
      }
      this.unsubscribe();
    }
  }

  complete() {
    if (!this.isStopped && this.complete) {
      // 先判斷是否停止過
      try {
        this.destination.complete(); // 發送停止訊息
      } catch (err) {
        this.unsubscribe();
        throw err;
      }
      this.unsubscribe(); // 發送停止訊息後退訂
    }
  }
  
  unsubscribe() {
    this.isStopped = true;
  }
}

/******     上一篇的內容      ******/

// function create(subscriber) {
//     const observable = {
//         subscribe: function(observerOrNext, error, complete) {
//             const realObserver = new Observer(observerOrNext, error, complete)
//             subscriber(realObserver);
//             return realObserver;
//         }       
//     };
//     return observable;
// }



class MapObserver extends Observer {
  constructor(observer, callback) {
    // 這裡會傳入原本的 observer 跟 map 的 callback
    super(observer); // 因為有繼承所以要先執行一次父層的建構式
    this.callback = callback; // 保存 callback
    this.next = this.next.bind(this); // 確保 next 的 this
  }
  next(value) {
    try {
      this.destination.next(this.callback(value)); 
      // this.destination 是父層 Observer 保存的 observer 物件
      // 這裡 this.callback(value) 就是 map 的操作
    } catch (err) {
      this.destination.error(err);
      return;
    }
  }
}

class Observable {
  constructor(subscribe) {
    this._subscribe = subscribe; // 把 subscribe 存到屬性中
  }
  subscribe(observerOrNext, error, complete) {
    const observer = new Observer(observerOrNext, error, complete);
    // 先用 this.operator 判斷當前的 observable 是否具有 operator 
    if(this.operator) {
      this.operator.call(observer, this.source)
    } else {
      // 如果沒有 operator 再直接把 observer 丟給 _subscribe
      this._subscribe(observer);
    }
    return observer;
  }
  map(callback) {
    const observable = new Observable(); // 建立新的 observable
    
    observable.source = this; // 保存當前的 observable(資料源)
    
    observable.operator = {
        call: (observer, source) => { 
            // 執行這個 operator 的行為
            const newObserver = new MapObserver(observer, callback);
            // 建立包裹後的 observer
            // 訂閱原本的資料源，並回傳
            return source.subscribe(newObserver);
        }
    }; // 儲存當前 operator 行為，並作為是否有 operator 的依據，
    
    return observable; // 返回這個新的 observable
  }
}

Observable.create = function(subscribe) {
    return new Observable(subscribe);
}

Observable.fromArray = function(array) {
    if(!Array.isArray(array)) {
        throw new Error('params need to be an array');
    }
    return new Observable(function(observer) {
        try{
            array.forEach(value => observer.next(value))
            observer.complete()
        } catch(err) {
            observer.error(err)
        }
    });
}

var observable = Observable.fromArray([1,2,3,4,5])
                  .map(x => x + 3)
                  .map(x => x + 1)

var observer = {
  next: function(value) {
    console.log(value)
  },
  complete: function() {
      console.log('complete!')
  }
}

observable.subscribe(observer);