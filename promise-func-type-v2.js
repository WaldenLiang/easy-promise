const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

function EasyPromise(func) {
  if (typeof func !== "function") {
    throw new TypeError("promise resolver must be a function");
  }

  let _status = StatusMap.PENDING;
  let _handlers = [];
  let _value;
  let _reason;

  function _resolver(value) {
    if (_status === StatusMap.PENDING) {
      _value = value;
      _status = StatusMap.FULFILLED;
      _handlers.splice(0).forEach(({ onFulfilled, onRejected, next }) => {
        _resolveOrReject(onFulfilled, onRejected, next);
      });
    }
  }

  function _rejecter(reason) {
    if (_status === StatusMap.PENDING) {
      _status = StatusMap.REJECTED;
      _reason = reason;
      _handlers.splice(0).forEach(({ onFulfilled, onRejected, next }) => {
        _resolveOrReject(onFulfilled, onRejected, next);
      });
    }
  }

  func(_resolver, _rejecter);

  this.then = function (onFulfilled, onRejected) {
    const next = {};
    const promise = new EasyPromise(function (resolve, reject) {
      next.resolve = resolve;
      next.reject = reject;
    });
    next.promise = promise;

    if (_status === StatusMap.PENDING) {
      const handler = { next };

      if (typeof onFulfilled === "function") {
        handler.onFulfilled = onFulfilled;
      }

      if (typeof onRejected === "function") {
        handler.onRejected = onRejected;
      }

      _handlers.push(handler);
    } else {
      _resolveOrReject(onFulfilled, onRejected, next);
    }
    return promise;
  };

  function _resolveOrReject(onFulfilled, onRejected, next) {
    const isFulfilled = _status === StatusMap.FULFILLED;
    const handler = isFulfilled ? onFulfilled : onRejected;
    setTimeout(function () {
      if (typeof handler === "function") {
        try {
          const value = handler(isFulfilled ? _value : _reason);
          if (value === next.promise) {
            throw new TypeError(
              "The `promise` and `x` cannot refer to the same object."
            );
          }

          if (
            typeof value === "function" ||
            (value !== null && typeof value === "object")
          ) {
            next.promise.then = value.then;

            if (typeof next.promise.then === "function") {
              let xStatus = StatusMap.PENDING;
              try {
                next.promise.then.apply(value, [
                  function (y) {
                    if (xStatus === StatusMap.PENDING) {
                      xStatus = StatusMap.FULFILLED;
                      innerResolver(y);

                      function innerResolver(_y) {
                        let __status = StatusMap.PENDING;
                        try {
                          const then = _y && _y.then;
                          if (typeof then === "function") {
                            then.apply(_y, [
                              function (__v) {
                                if (__status === StatusMap.PENDING) {
                                  __status = StatusMap.FULFILLED;
                                  innerResolver(__v);
                                }
                              },
                              function (__r) {
                                if (__status === StatusMap.PENDING) {
                                  __status = StatusMap.REJECTED;
                                  // innerResolver(__r);
                                  next.reject(__r);
                                }
                              },
                            ]);
                          } else {
                            if (__status === StatusMap.PENDING) {
                              __status = StatusMap.FULFILLED;
                              next.resolve(_y);
                            }
                          }
                        } catch (e) {
                          if (__status === StatusMap.PENDING) {
                            __status = StatusMap.REJECTED;
                            next.reject(e);
                          }
                        }
                      }
                    }
                  },
                  function (r) {
                    if (xStatus === StatusMap.PENDING) {
                      xStatus = StatusMap.REJECTED;
                      next.reject(r);
                    }
                  },
                ]);
              } catch (_e) {
                if (xStatus === StatusMap.PENDING) {
                  xStatus = StatusMap.REJECTED;
                  next.reject(_e);
                }
              }
            } else {
              next.resolve(value);
            }
          } else {
            next.resolve(value);
          }
        } catch (e) {
          next.reject(e);
        }
      } else {
        isFulfilled ? next.resolve(_value) : next.reject(_reason);
      }
    }, 0);
  }
}

module.exports = EasyPromise;
