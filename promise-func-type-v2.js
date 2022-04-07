const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

function EasyPromise(func) {
  if (typeof func !== "function") {
    throw new TypeError("promise resolver must be a function");
  }

  func(_resolveHook, _rejectHook);

  let _status = PENDING;
  let _awaitQueue = [];
  let _value;
  let _reason;

  this.then = function (onFulfilled, onRejected) {
    const promise2 = new EasyPromise(function (resolve, reject) {
      if (_status === PENDING) {
        _awaitQueue.push({
          resolve: resolveFunc,
          reject: rejectFunc,
        });
      } else if (_status === FULFILLED) {
        resolveFunc(_value);
      } else if (_status === REJECTED) {
        rejectFunc(_reason);
      }

      function resolveFunc(v) {
        setTimeout(function () {
          if (typeof onFulfilled === "function") {
            try {
              const x = onFulfilled(v);
              _resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          } else {
            resolve(v);
          }
        }, 0);
      }

      function rejectFunc(r) {
        setTimeout(function () {
          if (typeof onRejected === "function") {
            try {
              const x = onRejected(r);
              _resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(r);
          }
        }, 0);
      }
    });

    return promise2;
  };

  function _resolveHook(v) {
    if (_status === PENDING) {
      _value = v;
      _status = FULFILLED;

      _awaitQueue.splice(0).forEach(function ({ resolve }) {
        resolve(v);
      });
    }
  }

  function _rejectHook(r) {
    if (_status === PENDING) {
      _reason = r;
      _status = REJECTED;

      _awaitQueue.splice(0).forEach(function ({ reject }) {
        reject(r);
      });
    }
  }

  function _resolvePromise(promise2, x, resolve, reject) {
    if (promise2 === x) {
      reject(
        new TypeError("The `promise` and `x` cannot refer to the same object.")
      );
    }

    if (x && (typeof x === "object" || typeof x === "function")) {
      let lock = false;

      try {
        const then = x.then;

        if (typeof then === "function") {
          then.call(
            x,
            function (y) {
              !lock &&
                ((lock = true), _resolvePromise(promise2, y, resolve, reject));
            },
            function (r) {
              !lock && ((lock = true), reject(r));
            }
          );
        } else {
          !lock && ((lock = true), resolve(x));
        }
      } catch (e) {
        !lock && ((lock = true), reject(e));
      }
    } else {
      resolve(x);
    }
  }
}

module.exports = EasyPromise;
