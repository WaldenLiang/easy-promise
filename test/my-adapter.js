const EasyPromise = require("../promise-func-type-v2");

exports.deferred = () => {
  const _tmp = {};
  const promise = new EasyPromise((resolve, reject) => {
    _tmp.resolve = resolve;
    _tmp.reject = reject;
  });

  _tmp.promise = promise;

  return _tmp;
};
