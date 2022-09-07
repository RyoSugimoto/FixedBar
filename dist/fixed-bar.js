var FixedBar = (function () {
    'use strict';

    class FixedBar {
      constructor(args) {
        this.isExpanded = false;
        this.reverse = false;
        this.revivalTimer = undefined;
        this.isClosedEternally = false;
        this.freezed = false;
        this.intersectionObserveOption = {};
        if (typeof args.bar !== 'string') throw new Error(`FixedBar: The property 'bar' must be required.`);
        this.bar = document.querySelector(args.bar);
        if (!this.bar) throw new Error(`FixedBar: The Element doesn't exist.`);
        this.bar.setAttribute('data-fixed-bar', '');

        this._switchState(this.isExpanded);

        if (typeof args.range !== 'string') throw new Error(`FixedBar: The property 'range' must be required.`);
        this.ranges = document.querySelectorAll(args.range);
        if (!this.ranges || this.ranges.length === 0) throw new Error(`FixedBar: The range element is not found.`);
        if (typeof args.reverse !== 'undefined') this.reverse = args.reverse;

        if (typeof args.intersectionObserveOption !== 'undefined') {
          this.intersectionObserveOption = args.intersectionObserveOption;
        }

        this.observer = new IntersectionObserver(this._observe.bind(this), this.intersectionObserveOption);

        for (let i = 0; i < this.ranges.length; i++) {
          this.observer.observe(this.ranges[i]);
        }
      }

      _observe(entries) {
        if (this.revivalTimer || this.isClosedEternally || this.freezed) return;
        let isIntersecting = false;

        for (let i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            isIntersecting = true;
            break;
          }
        }

        if (!this.reverse && isIntersecting || this.reverse && !isIntersecting) {
          this.open();
        } else {
          this.close(0);
        }
      }

      open() {
        this.isExpanded = true;

        this._switchState(true);

        this.isClosedEternally = false;
        if (this.revivalTimer) window.clearTimeout(this.revivalTimer);
      }

      close(time) {
        this.isExpanded = false;

        this._switchState(false);

        if (typeof time === 'number' && time === 0) ; else if (typeof time === 'number' && time > 0) {
          this.revivalTimer = window.setTimeout(() => {
            window.clearTimeout(this.revivalTimer);
            this.revivalTimer = undefined;
          }, time);
        } else {
          this.isClosedEternally = true;
        }
      }

      freeze(isExpanded = true) {
        isExpanded ? this.open() : this.close();
        this.freezed = true;
      }

      restart() {
        this.freezed = false;
      }

      _switchState(isExpanded) {
        var _this$bar;

        (_this$bar = this.bar) === null || _this$bar === void 0 ? void 0 : _this$bar.setAttribute('aria-hidden', String(!isExpanded));

        if (isExpanded) {
          var _this$bar2, _this$bar3;

          (_this$bar2 = this.bar) === null || _this$bar2 === void 0 ? void 0 : _this$bar2.removeAttribute('hidden');
          (_this$bar3 = this.bar) === null || _this$bar3 === void 0 ? void 0 : _this$bar3.removeAttribute('inert');
        } else {
          var _this$bar4, _this$bar5;

          (_this$bar4 = this.bar) === null || _this$bar4 === void 0 ? void 0 : _this$bar4.setAttribute('hidden', '');
          (_this$bar5 = this.bar) === null || _this$bar5 === void 0 ? void 0 : _this$bar5.setAttribute('inert', '');
        }
      }

    }

    return FixedBar;

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLmpzIiwic291cmNlcyI6WyIuLi9zcmMvdHMvZml4ZWQtYmFyLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBkZWZhdWx0IGNsYXNzIEZpeGVkQmFyIHtcbiAgYmFyOiBIVE1MRWxlbWVudCB8IG51bGxcbiAgcmFuZ2VzOiBOb2RlTGlzdE9mPEhUTUxFbGVtZW50PiB8IG51bGxcbiAgb2JzZXJ2ZXI6IEludGVyc2VjdGlvbk9ic2VydmVyXG4gIGlzRXhwYW5kZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICByZXZlcnNlOiBib29sZWFuID0gZmFsc2VcbiAgcmV2aXZhbFRpbWVyOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcbiAgaXNDbG9zZWRFdGVybmFsbHk6IGJvb2xlYW4gPSBmYWxzZVxuICBmcmVlemVkOiBib29sZWFuID0gZmFsc2VcbiAgaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbj86IEludGVyc2VjdGlvbk9ic2VydmVySW5pdCA9IHt9XG5cbiAgY29uc3RydWN0b3IoYXJnczoge1xuICAgIGJhcjogc3RyaW5nXG4gICAgcmFuZ2U6IHN0cmluZ1xuICAgIGNsb3Nlcj86IHN0cmluZ1xuICAgIHJldmVyc2U/OiBib29sZWFuXG4gICAgaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbj86IEludGVyc2VjdGlvbk9ic2VydmVySW5pdFxuICB9KSB7XG4gICAgaWYgKHR5cGVvZiBhcmdzLmJhciAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihgRml4ZWRCYXI6IFRoZSBwcm9wZXJ0eSAnYmFyJyBtdXN0IGJlIHJlcXVpcmVkLmApXG4gICAgdGhpcy5iYXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGFyZ3MuYmFyKVxuICAgIGlmICghdGhpcy5iYXIpIHRocm93IG5ldyBFcnJvcihgRml4ZWRCYXI6IFRoZSBFbGVtZW50IGRvZXNuJ3QgZXhpc3QuYClcbiAgICB0aGlzLmJhci5zZXRBdHRyaWJ1dGUoJ2RhdGEtZml4ZWQtYmFyJywgJycpXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodGhpcy5pc0V4cGFuZGVkKVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzLnJhbmdlICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBGaXhlZEJhcjogVGhlIHByb3BlcnR5ICdyYW5nZScgbXVzdCBiZSByZXF1aXJlZC5gKVxuICAgIHRoaXMucmFuZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChhcmdzLnJhbmdlKVxuICAgIGlmICghdGhpcy5yYW5nZXMgfHwgdGhpcy5yYW5nZXMubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoYEZpeGVkQmFyOiBUaGUgcmFuZ2UgZWxlbWVudCBpcyBub3QgZm91bmQuYClcbiAgICBpZiAodHlwZW9mIGFyZ3MucmV2ZXJzZSAhPT0gJ3VuZGVmaW5lZCcpIHRoaXMucmV2ZXJzZSA9IGFyZ3MucmV2ZXJzZVxuICAgIGlmICh0eXBlb2YgYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uID0gYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uXG4gICAgfVxuXG4gICAgdGhpcy5vYnNlcnZlciA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihcbiAgICAgIHRoaXMuX29ic2VydmUuYmluZCh0aGlzKSwgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5yYW5nZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUodGhpcy5yYW5nZXNbaV0pXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfb2JzZXJ2ZShlbnRyaWVzOiBJbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5W10pIHtcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIgfHwgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSB8fCB0aGlzLmZyZWV6ZWQpIHJldHVyblxuXG4gICAgbGV0IGlzSW50ZXJzZWN0aW5nID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZW50cmllc1tpXS5pc0ludGVyc2VjdGluZykge1xuICAgICAgICBpc0ludGVyc2VjdGluZyA9IHRydWVcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKCF0aGlzLnJldmVyc2UgJiYgaXNJbnRlcnNlY3RpbmcpIHx8ICh0aGlzLnJldmVyc2UgJiYgIWlzSW50ZXJzZWN0aW5nKSkge1xuICAgICAgdGhpcy5vcGVuKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbG9zZSgwKVxuICAgIH1cbiAgfVxuXG4gIG9wZW4oKSB7XG4gICAgdGhpcy5pc0V4cGFuZGVkID0gdHJ1ZVxuICAgIHRoaXMuX3N3aXRjaFN0YXRlKHRydWUpXG4gICAgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSA9IGZhbHNlXG4gICAgaWYgKHRoaXMucmV2aXZhbFRpbWVyKSB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmV2aXZhbFRpbWVyKVxuICB9XG5cbiAgY2xvc2UodGltZT86IG51bWJlcikge1xuICAgIHRoaXMuaXNFeHBhbmRlZCA9IGZhbHNlXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUoZmFsc2UpXG4gICAgaWYgKHR5cGVvZiB0aW1lID09PSAnbnVtYmVyJyAmJiB0aW1lID09PSAwKSB7XG4gICAgICAvL1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInICYmIHRpbWUgPiAwKSB7XG4gICAgICB0aGlzLnJldml2YWxUaW1lciA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJldml2YWxUaW1lcilcbiAgICAgICAgdGhpcy5yZXZpdmFsVGltZXIgPSB1bmRlZmluZWRcbiAgICAgIH0sIHRpbWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgPSB0cnVlXG4gICAgfVxuICB9XG5cbiAgZnJlZXplKGlzRXhwYW5kZWQ6IGJvb2xlYW4gPSB0cnVlKSB7XG4gICAgaXNFeHBhbmRlZCA/IHRoaXMub3BlbigpIDogdGhpcy5jbG9zZSgpXG4gICAgdGhpcy5mcmVlemVkID0gdHJ1ZVxuICB9XG5cbiAgcmVzdGFydCgpIHtcbiAgICB0aGlzLmZyZWV6ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIHByaXZhdGUgX3N3aXRjaFN0YXRlKGlzRXhwYW5kZWQ6IGJvb2xlYW4pIHtcbiAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdhcmlhLWhpZGRlbicsIFN0cmluZyghaXNFeHBhbmRlZCkpXG4gICAgaWYgKGlzRXhwYW5kZWQpIHtcbiAgICAgIHRoaXMuYmFyPy5yZW1vdmVBdHRyaWJ1dGUoJ2hpZGRlbicpXG4gICAgICB0aGlzLmJhcj8ucmVtb3ZlQXR0cmlidXRlKCdpbmVydCcpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2hpZGRlbicsICcnKVxuICAgICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnaW5lcnQnLCAnJylcbiAgICB9XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJGaXhlZEJhciIsImNvbnN0cnVjdG9yIiwiYXJncyIsInVuZGVmaW5lZCIsImJhciIsIkVycm9yIiwiZG9jdW1lbnQiLCJxdWVyeVNlbGVjdG9yIiwic2V0QXR0cmlidXRlIiwiX3N3aXRjaFN0YXRlIiwiaXNFeHBhbmRlZCIsInJhbmdlIiwicmFuZ2VzIiwicXVlcnlTZWxlY3RvckFsbCIsImxlbmd0aCIsInJldmVyc2UiLCJpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uIiwib2JzZXJ2ZXIiLCJJbnRlcnNlY3Rpb25PYnNlcnZlciIsIl9vYnNlcnZlIiwiYmluZCIsImkiLCJvYnNlcnZlIiwiZW50cmllcyIsInJldml2YWxUaW1lciIsImlzQ2xvc2VkRXRlcm5hbGx5IiwiZnJlZXplZCIsImlzSW50ZXJzZWN0aW5nIiwib3BlbiIsImNsb3NlIiwid2luZG93IiwiY2xlYXJUaW1lb3V0IiwidGltZSIsInNldFRpbWVvdXQiLCJmcmVlemUiLCJyZXN0YXJ0IiwiU3RyaW5nIiwicmVtb3ZlQXR0cmlidXRlIl0sIm1hcHBpbmdzIjoiOzs7VUFBcUJBO0lBV25CQyxFQUFBQSxZQUFZQztJQVBaLG1CQUFBLEdBQXNCLEtBQXRCO0lBQ0EsZ0JBQUEsR0FBbUIsS0FBbkI7SUFDQSxxQkFBQSxHQUFtQ0MsU0FBbkM7SUFDQSwwQkFBQSxHQUE2QixLQUE3QjtJQUNBLGdCQUFBLEdBQW1CLEtBQW5CO0lBQ0Esa0NBQUEsR0FBdUQsRUFBdkQ7SUFTRSxRQUFJLE9BQU9ELElBQUksQ0FBQ0UsR0FBWixLQUFvQixRQUF4QixFQUFrQyxNQUFNLElBQUlDLEtBQUosaURBQUEsQ0FBTjtJQUNsQyxTQUFLRCxHQUFMLEdBQVdFLFFBQVEsQ0FBQ0MsYUFBVCxDQUF1QkwsSUFBSSxDQUFDRSxHQUE1QixDQUFYO0lBQ0EsUUFBSSxDQUFDLEtBQUtBLEdBQVYsRUFBZSxNQUFNLElBQUlDLEtBQUosdUNBQUEsQ0FBTjtJQUNmLFNBQUtELEdBQUwsQ0FBU0ksWUFBVCxDQUFzQixnQkFBdEIsRUFBd0MsRUFBeEM7O0lBQ0EsU0FBS0MsWUFBTCxDQUFrQixLQUFLQyxVQUF2Qjs7SUFFQSxRQUFJLE9BQU9SLElBQUksQ0FBQ1MsS0FBWixLQUFzQixRQUExQixFQUFvQyxNQUFNLElBQUlOLEtBQUosbURBQUEsQ0FBTjtJQUNwQyxTQUFLTyxNQUFMLEdBQWNOLFFBQVEsQ0FBQ08sZ0JBQVQsQ0FBMEJYLElBQUksQ0FBQ1MsS0FBL0IsQ0FBZDtJQUNBLFFBQUksQ0FBQyxLQUFLQyxNQUFOLElBQWdCLEtBQUtBLE1BQUwsQ0FBWUUsTUFBWixLQUF1QixDQUEzQyxFQUE4QyxNQUFNLElBQUlULEtBQUosNENBQUEsQ0FBTjtJQUM5QyxRQUFJLE9BQU9ILElBQUksQ0FBQ2EsT0FBWixLQUF3QixXQUE1QixFQUF5QyxLQUFLQSxPQUFMLEdB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
