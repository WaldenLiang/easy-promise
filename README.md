---
title: 手撸 Promise 的思路分享
date: 2022-04-07 13:58:34
category: 理性
tags: Javascript,Promise
---

前段时间在几个大牛作者的微信公众号上都看到了手撸 Promise 的文章，当时就觉得挺有意思，想自己也手撸一遍顺便检验一下基础，所以我当时没有看大佬们的代码实现，怕产生潜意识。正好这段时间比较空闲，于是撸了两个版本。第一版（v1）是第一次跑通用例的版本，很粗糙；而第二版（v2）是在第一版的基础上并结合官方测试用例的测试思路优化过后的版本，是我个人比较满意的版本，它可能不是最优版本（跑完 872 条用例耗时 16s），但应该是比较直观易懂的版本。

这里贴出测试结果：

```
 ...省略前面内容
    The value is `1` with `Number.prototype` modified to have a `then` method
      ✓ already-fulfilled
      ✓ immediately-fulfilled
      ✓ eventually-fulfilled
      ✓ already-rejected
      ✓ immediately-rejected
      ✓ eventually-rejected


  872 passing (16s)
```

本文主要想跟大家分享一下实现思路，希望能够对感兴趣但没有思路的小伙伴们有帮助。

## 实现思路

Promise 是一种机制，形象（自以为形象）的做一个比喻，Promise 机制就好像一个导水装置。这个导水装置有几个组成部分：

1. 有一个入水口 T；
2. 有一个储水管道；
3. 有两个出水口，分别是 F 出水口，和 R 出水口；
4. 有两个拉闸 FHook 拉闸 和 RHook 和拉闸，分别控制两个出水口打开；

导水装置的工作机制：

1. 出水口最开始状态都是关闭的，只能通过两个拉闸控制打开；
2. 出水口永远最多只能打开一个，且开了就无法关闭，即 FHook 和 RHook 只能被拉一次（不是分别拉一次，是总共一次），多拉无效；
3. 入水口 T 可以在任意时候注水；
4. 注水时，如果出口没有被打开，水会存储在储水管道内，直到有一个门被打开；
5. 注水时，如果出水口已开，水会直接导出，无需在储水管道内存储；
6. 最先注入的水会最先被导出，导出的水不允许回收；

上面的比喻是个人总结，仅仅是为了更好的帮助大家初步理解，但并不能覆盖到 Promise 所有的机制，所以到真正实现的时候，希望大家不要被这个比喻局限。下面我们尝试把原生的 Promise 代入到导水装置进行组成拆分。

```javascript
// 新建了一个`promise`，可理解为是一个导水装置
// 初始状态，出水口都是关闭的，我们用 `pending` 来表示该状态
const promise = new Promise(function (resolve, reject) {
  // `resolve` 就是 F 出水口的拉闸 FHook
  // `reject` 就是 R 出水口的拉闸 RHook
  //! 两个拉闸都是导水装置的固有组成部分，它们不能代表此时装置的状态
  //! 只有真正的拉动拉闸（即方法调用），装置的状态才会改变

  // 我们设置延时，1s 后再去拉闸
  setTimeout(function () {
    if (condition) {
      // 这里是 `condition` 是伪代码，模拟判断条件
      // `resolve()` 表示拉动了 FHook 拉闸，F 出水口会被打开
      // 我们用 `fulfilled` 来表示 F 出水口已被打开
      resolve();
      // 第二次的拉闸动作是无效行为
      resolve();
      // 此时的 R 出水口不可以被打开了，所以拉 RHook 也是一个无效行为
      reject();
    } else {
      // 如果不满足 `condition` 条件，则会打开 R 出水口
      // 我们用 `rejected` 来表示 R 出水口已被打开
      reject();
      // 同样，重复或其他拉闸操作都是无效行为
      reject();
      resolve();
    }
  }, 1000);
});

// `promise.then` 就是导水装置的唯一入水口 T
// 只能通过它来进行注水
// 而 `onFulfilled` 和 `onRejected` 合起来就是一个单位的水（暂时这么理解）
// 由于此时出水口还没有被打开（1s 后才拉闸），所以注入的水会被存储起来
promise.then(
  function onFulfilled() {
    // do something when promise fulfilled
  },
  function onRejected() {
    // do something when promise rejected
  }
);

// 我们可以在任何时候注水
// 此单位的也会被存储
promise.then(
  function onFulfilled() {},
  function onRejected() {}
);

setTimeout(function () {
  // 我们可以在任何时候注水
  // 此单位的也会被存储
  promise.then(
    function onFulfilled() {},
    function onRejected() {}
  );
}, 300);

setTimeout(function () {
  // 我们可以在任何时候注水
  // 此时出水口已被打开（2s 前被打开了），此单位的水会直接被导出，无需存储
  promise.then(
    function onFulfilled() {},
    function onRejected() {}
  );
}, 3000);
```

## 初步实现

经过上面的分析，我们现一起简单地用代码来实现这个“导水装置”。

```javascript
// 定义“装置”的三个状态常量
// 所有出口关闭
const PENDING = "pending";
// F 出水口已打开
const FULFILLED = "fulfilled";
// R 出水口已打开
const REJECTED = "rejected";

// 这里采用 Function-Type 来实现，当然也可以用Class-Type
function EasyPromise(func) {
  // func 是必须的，否则无法“安装拉闸”
  if (typeof func !== "function") {
    throw new TypeError("promise resolver must be a function");
  }

  // 安装拉闸
  func(_resolveHook, _rejectHook);

  // 初始状态
  let _status = PENDING;
  // 这是储水管道
  let _awaitQueue = [];

  // 入水口
  this.then = function (onFulfilled, onRejected) {
    if (_status === PENDING) {
      // 进行储水操作
      // TODO: 实现储水逻辑
      _awaitQueue.push({});
    } else if (_status === FULFILLED) {
      // 直接导出
      // TODO: 实现 F 出水口导水逻辑
    } else if (_status === REJECTED) {
      // 直接导出
      // TODO: 实现 R 出水口导水逻辑
    }
  };

  // F 出水口拉闸 FHook
  function _resolveHook() {
    // 忽略重复拉闸的无效行为
    if (_status === PENDING) {
      // 打开 F 出水口
      _status = FULFILLED;
      // 导出管道中的水
      _awaitQueue.splice(0).forEach(function () {
        // do something
      });
    }
  }

  // R 出水口拉闸 RHook
  function _rejectHook() {
    // 忽略重复拉闸的无效行为
    if (_status === PENDING) {
      // 打开 R 出水口
      _status = REJECTED;
      // 导出管道中的水
      _awaitQueue.splice(0).forEach(function () {
        // do something
      });
    }
  }
}
```

以上便是这个“导水装置”的大概长得样子，当然这不是 Promise 的最终的实现，这仅仅是一个“骨架”而已。要实现正真的 Promise 机制需要补充 Promise 的机制说明，我们可以阅读 [Promise A+规范](https://promisesaplus.com/) 来补充，中文版这可以阅读这位大佬的 [译文](https://zhuanlan.zhihu.com/p/143204897)。

以上就是本人的实现思路，为了能够让对 Promise 的原理感兴趣的伙伴们能够快速找到实现思路，我大胆的给出一个“形象”的比喻，希望能够帮助到大家，而没有被误导到。

## Promise 完整实现

以下是本人手撸 Promise 机制的完整实现。

```javascript
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
```
