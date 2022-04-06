const promise = new Promise((resolve, reject) => {
  console.log(11111);
  if (condition) {
    // http request
    setTimeout(() => resolve(value), 1000);
  } else {
    reject(reason);
  }
});

promise.then((value) => {
  console.log(value);
});

setTimeout(() => {
  promise.then((value) => {
    console.log(value);
  });
}, 4000);

console.log("hhhh");
