/**
 * Module dependencies.
 */

var superagent = require('superagent');

var RATE = 120; // requests per minute 

/**
 * Module exports.
 */

module.exports = function(rate) {

  /**
   * Extends the built-in dependency.
   */

  RATE = rate;

  extend(superagent);
  return extend;
};

/**
 * Installs the `queue` extension to superagent.
 *
 * @param {Object} superagent module
 * @api public
 */

function extend(sa) {
  var Request = sa.Request;

  /**
   * Queues.
   */

  var queues = {};
  var running = {};

  /**
   * `queue` method.
   *
   * @param {String} name of the queue
   * @return {Request} for chaining
   * @api public
   */

  Request.prototype.queue = function(name) {
    this.queueName = name;
    return this;
  };

  /**
   * Reference to original `end`.
   */

  var oldEnd = Request.prototype.end;

  /**
   * Checks for queued requests.
   *
   * @api private
   */

  function unqueue(name) {
    var item = queues[name].shift();

    if (!item) {
      delete queues[name];
      return;
    }

    var obj = item[0];
    var fn = item[1];

    var delay = (60 / RATE) * 1000;
    delay = delay < 0 ? 0 : delay;

    setTimeout(function() {

      // immutable .length hack :\
      if (!fn) {
        oldEnd.call(obj, function() {
          unqueue(name);
        });
      } else if (fn.length == 1) {
        oldEnd.call(obj, function(res) {
          fn && fn(res);
          unqueue(name);
        });
      } else {
        oldEnd.call(obj, function(err, res) {
          fn && fn(err, res);
          unqueue(name);
        });
      }
    }, delay);
  }

  /**
   * Overrides `end` method to defer calls.
   *
   * @api private
   */

  Request.prototype.end = function(fn) {
    var queue = this.queueName;

    if (queue) {
      if (!queues[queue]) {
        queues[queue] = [
          [this, fn]
        ];
        unqueue(queue);
      } else {
        queues[queue].push([this, fn]);
      }
    } else {
      oldEnd.call(this, fn);
    }
  };
};
