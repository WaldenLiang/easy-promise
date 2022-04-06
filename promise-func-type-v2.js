const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

function EasyPromise(func) {
  if (typeof func !== "function") {
    throw new TypeError("promise resolver must be a function");
  }

  func(_resolveHook, _rejectHook);

  let status = PENDING;
  let awaitQueue = [];
  let value;
  let reason;

  this.then = function (onFulfilled, onRejected) {
    const promise2 = new EasyPromise(function (resolve, reject) {
      if (status === PENDING) {
      } else if (status === FULFILLED) {
        const x = onFulfilled(value);
      } else if (status === REJECTED) {
        const x = onRejected(r);
      }
    });

    return promise2;
  };

  function _resolveHook(v) {
    if (status === PENDING) {
      value = v;
      status = FULFILLED;

      awaitQueue.splice(0).forEach(function (args) {
        _resolveOrReject(args);
      });
    }
  }

  function _rejectHook(r) {
    if (status === PENDING) {
      reason = r;
      status = REJECTED;

      awaitQueue.splice(0).forEach(function (args) {
        _resolveOrReject(args);
      });
    }
  }

  function _resolveOrReject([
    onFulfilled,
    onRejected,
    promise2,
    resolve,
    reject,
  ]) {
    const isFulfilled = status === FULFILLED;
    const handler = isFulfilled ? onFulfilled : onRejected;

    if (typeof handler === "function") {
      setTimeout(function () {
        try {
          const x = handler(isFulfilled ? value : reason);
          if (x === promise2) {
            throw new TypeError(
              "The `promise` and `x` cannot refer to the same object."
            );
          }

          if (
            typeof x === "function" ||
            (x !== null && typeof x === "object")
          ) {
            const then = x.then;

            if (typeof then === "function") {
              let xStatus = PENDING;
              try {
                then.apply(x, [
                  function (y) {
                    if (xStatus === PENDING) {
                      xStatus = FULFILLED;
                      innerResolver(y);

                      function innerResolver(_y) {
                        let __status = PENDING;
                        try {
                          const then = _y && _y.then;
                          if (typeof then === "function") {
                            then.apply(_y, [
                              function (__v) {
                                if (__status === PENDING) {
                                  __status = FULFILLED;
                                  innerResolver(__v);
                                }
                              },
                              function (__r) {
                                if (__status === PENDING) {
                                  __status = REJECTED;
                                  reject(__r);
                                }
                              },
                            ]);
                          } else {
                            if (__status === PENDING) {
                              __status = FULFILLED;
                              resolve(_y);
                            }
                          }
                        } catch (e) {
                          if (__status === PENDING) {
                            __status = REJECTED;
                            reject(e);
                          }
                        }
                      }
                    }
                  },
                  function (r) {
                    if (xStatus === PENDING) {
                      xStatus = REJECTED;
                      reject(r);
                    }
                  },
                ]);
              } catch (_e) {
                if (xStatus === PENDING) {
                  xStatus = REJECTED;
                  reject(_e);
                }
              }
            } else {
              resolve(x);
            }
          } else {
            resolve(x);
          }
        } catch (e) {
          reject(e);
        }
      }, 0);
    } else {
      isFulfilled ? resolve(value) : reject(reason);
    }
  }
}

module.exports = EasyPromise;
