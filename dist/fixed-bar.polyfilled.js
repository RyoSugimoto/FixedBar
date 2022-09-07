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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLnBvbHlmaWxsZWQuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy90cy9maXhlZC1iYXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGRlZmF1bHQgY2xhc3MgRml4ZWRCYXIge1xuICBiYXI6IEhUTUxFbGVtZW50IHwgbnVsbFxuICByYW5nZXM6IE5vZGVMaXN0T2Y8SFRNTEVsZW1lbnQ+IHwgbnVsbFxuICBvYnNlcnZlcjogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJcbiAgaXNFeHBhbmRlZDogYm9vbGVhbiA9IGZhbHNlXG4gIHJldmVyc2U6IGJvb2xlYW4gPSBmYWxzZVxuICByZXZpdmFsVGltZXI6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICBpc0Nsb3NlZEV0ZXJuYWxseTogYm9vbGVhbiA9IGZhbHNlXG4gIGZyZWV6ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0ID0ge31cblxuICBjb25zdHJ1Y3RvcihhcmdzOiB7XG4gICAgYmFyOiBzdHJpbmdcbiAgICByYW5nZTogc3RyaW5nXG4gICAgY2xvc2VyPzogc3RyaW5nXG4gICAgcmV2ZXJzZT86IGJvb2xlYW5cbiAgICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0XG4gIH0pIHtcbiAgICBpZiAodHlwZW9mIGFyZ3MuYmFyICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBGaXhlZEJhcjogVGhlIHByb3BlcnR5ICdiYXInIG11c3QgYmUgcmVxdWlyZWQuYClcbiAgICB0aGlzLmJhciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYXJncy5iYXIpXG4gICAgaWYgKCF0aGlzLmJhcikgdGhyb3cgbmV3IEVycm9yKGBGaXhlZEJhcjogVGhlIEVsZW1lbnQgZG9lc24ndCBleGlzdC5gKVxuICAgIHRoaXMuYmFyLnNldEF0dHJpYnV0ZSgnZGF0YS1maXhlZC1iYXInLCAnJylcbiAgICB0aGlzLl9zd2l0Y2hTdGF0ZSh0aGlzLmlzRXhwYW5kZWQpXG5cbiAgICBpZiAodHlwZW9mIGFyZ3MucmFuZ2UgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoYEZpeGVkQmFyOiBUaGUgcHJvcGVydHkgJ3JhbmdlJyBtdXN0IGJlIHJlcXVpcmVkLmApXG4gICAgdGhpcy5yYW5nZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKGFyZ3MucmFuZ2UpXG4gICAgaWYgKCF0aGlzLnJhbmdlcyB8fCB0aGlzLnJhbmdlcy5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihgRml4ZWRCYXI6IFRoZSByYW5nZSBlbGVtZW50IGlzIG5vdCBmb3VuZC5gKVxuICAgIGlmICh0eXBlb2YgYXJncy5yZXZlcnNlICE9PSAndW5kZWZpbmVkJykgdGhpcy5yZXZlcnNlID0gYXJncy5yZXZlcnNlXG4gICAgaWYgKHR5cGVvZiBhcmdzLmludGVyc2VjdGlvbk9ic2VydmVPcHRpb24gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB0aGlzLmludGVyc2VjdGlvbk9ic2VydmVPcHRpb24gPSBhcmdzLmludGVyc2VjdGlvbk9ic2VydmVPcHRpb25cbiAgICB9XG5cbiAgICB0aGlzLm9ic2VydmVyID0gbmV3IEludGVyc2VjdGlvbk9ic2VydmVyKFxuICAgICAgdGhpcy5fb2JzZXJ2ZS5iaW5kKHRoaXMpLCB0aGlzLmludGVyc2VjdGlvbk9ic2VydmVPcHRpb24pXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJhbmdlcy5sZW5ndGg7IGkrKyApIHtcbiAgICAgIHRoaXMub2JzZXJ2ZXIub2JzZXJ2ZSh0aGlzLnJhbmdlc1tpXSlcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9vYnNlcnZlKGVudHJpZXM6IEludGVyc2VjdGlvbk9ic2VydmVyRW50cnlbXSkge1xuICAgIGlmICh0aGlzLnJldml2YWxUaW1lciB8fCB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5IHx8IHRoaXMuZnJlZXplZCkgcmV0dXJuXG5cbiAgICBsZXQgaXNJbnRlcnNlY3RpbmcgPSBmYWxzZTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGVudHJpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChlbnRyaWVzW2ldLmlzSW50ZXJzZWN0aW5nKSB7XG4gICAgICAgIGlzSW50ZXJzZWN0aW5nID0gdHJ1ZVxuICAgICAgICBicmVha1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgoIXRoaXMucmV2ZXJzZSAmJiBpc0ludGVyc2VjdGluZykgfHwgKHRoaXMucmV2ZXJzZSAmJiAhaXNJbnRlcnNlY3RpbmcpKSB7XG4gICAgICB0aGlzLm9wZW4oKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNsb3NlKDApXG4gICAgfVxuICB9XG5cbiAgb3BlbigpIHtcbiAgICB0aGlzLmlzRXhwYW5kZWQgPSB0cnVlXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodHJ1ZSlcbiAgICB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5ID0gZmFsc2VcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXZpdmFsVGltZXIpXG4gIH1cblxuICBjbG9zZSh0aW1lPzogbnVtYmVyKSB7XG4gICAgdGhpcy5pc0V4cGFuZGVkID0gZmFsc2VcbiAgICB0aGlzLl9zd2l0Y2hTdGF0ZShmYWxzZSlcbiAgICBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInICYmIHRpbWUgPT09IDApIHtcbiAgICAgIC8vXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicgJiYgdGltZSA+IDApIHtcbiAgICAgIHRoaXMucmV2aXZhbFRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmV2aXZhbFRpbWVyKVxuICAgICAgICB0aGlzLnJldml2YWxUaW1lciA9IHVuZGVmaW5lZFxuICAgICAgfSwgdGltZSlcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSA9IHRydWVcbiAgICB9XG4gIH1cblxuICBmcmVlemUoaXNFeHBhbmRlZDogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBpc0V4cGFuZGVkID8gdGhpcy5vcGVuKCkgOiB0aGlzLmNsb3NlKClcbiAgICB0aGlzLmZyZWV6ZWQgPSB0cnVlXG4gIH1cblxuICByZXN0YXJ0KCkge1xuICAgIHRoaXMuZnJlZXplZCA9IGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3dpdGNoU3RhdGUoaXNFeHBhbmRlZDogYm9vbGVhbikge1xuICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgU3RyaW5nKCFpc0V4cGFuZGVkKSlcbiAgICBpZiAoaXNFeHBhbmRlZCkge1xuICAgICAgdGhpcy5iYXI/LnJlbW92ZUF0dHJpYnV0ZSgnaGlkZGVuJylcbiAgICAgIHRoaXMuYmFyPy5yZW1vdmVBdHRyaWJ1dGUoJ2luZXJ0JylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpXG4gICAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdpbmVydCcsICcnKVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbIkZpeGVkQmFyIiwiY29uc3RydWN0b3IiLCJhcmdzIiwidW5kZWZpbmVkIiwiYmFyIiwiRXJyb3IiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJzZXRBdHRyaWJ1dGUiLCJfc3dpdGNoU3RhdGUiLCJpc0V4cGFuZGVkIiwicmFuZ2UiLCJyYW5nZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwibGVuZ3RoIiwicmV2ZXJzZSIsImludGVyc2VjdGlvbk9ic2VydmVPcHRpb24iLCJvYnNlcnZlciIsIkludGVyc2VjdGlvbk9ic2VydmVyIiwiX29ic2VydmUiLCJiaW5kIiwiaSIsIm9ic2VydmUiLCJlbnRyaWVzIiwicmV2aXZhbFRpbWVyIiwiaXNDbG9zZWRFdGVybmFsbHkiLCJmcmVlemVkIiwiaXNJbnRlcnNlY3RpbmciLCJvcGVuIiwiY2xvc2UiLCJ3aW5kb3ciLCJjbGVhclRpbWVvdXQiLCJ0aW1lIiwic2V0VGltZW91dCIsImZyZWV6ZSIsInJlc3RhcnQiLCJTdHJpbmciLCJyZW1vdmVBdHRyaWJ1dGUiXSwibWFwcGluZ3MiOiI7OztVQUFxQkE7SUFXbkJDLEVBQUFBLFlBQVlDO0lBUFosbUJBQUEsR0FBc0IsS0FBdEI7SUFDQSxnQkFBQSxHQUFtQixLQUFuQjtJQUNBLHFCQUFBLEdBQW1DQyxTQUFuQztJQUNBLDBCQUFBLEdBQTZCLEtBQTdCO0lBQ0EsZ0JBQUEsR0FBbUIsS0FBbkI7SUFDQSxrQ0FBQSxHQUF1RCxFQUF2RDtJQVNFLFFBQUksT0FBT0QsSUFBSSxDQUFDRSxHQUFaLEtBQW9CLFFBQXhCLEVBQWtDLE1BQU0sSUFBSUMsS0FBSixpREFBQSxDQUFOO0lBQ2xDLFNBQUtELEdBQUwsR0FBV0UsUUFBUSxDQUFDQyxhQUFULENBQXVCTCxJQUFJLENBQUNFLEdBQTVCLENBQVg7SUFDQSxRQUFJLENBQUMsS0FBS0EsR0FBVixFQUFlLE1BQU0sSUFBSUMsS0FBSix1Q0FBQSxDQUFOO0lBQ2YsU0FBS0QsR0FBTCxDQUFTSSxZQUFULENBQXNCLGdCQUF0QixFQUF3QyxFQUF4Qzs7SUFDQSxTQUFLQyxZQUFMLENBQWtCLEtBQUtDLFVBQXZCOztJQUVBLFFBQUksT0FBT1IsSUFBSSxDQUFDUyxLQUFaLEtBQXNCLFFBQTFCLEVBQW9DLE1BQU0sSUFBSU4sS0FBSixtREFBQSxDQUFOO0lBQ3BDLFNBQUtPLE1BQUwsR0FBY04sUUFBUSxDQUFDTyxnQkFBVCxDQUEwQlgsSUFBSSxDQUFDUyxLQUEvQixDQUFkO0lBQ0EsUUFBSSxDQUFDLEtBQUtDLE1BQU4sSUFBZ0IsS0FBS0EsTUFBTCxDQUFZRSxNQUFaLEtBQXVCLENBQTNDLEVBQThDLE1BQU0sSUFBSVQsS0FBSiw0Q0FBQSxDQUFOO0lBQzlDLFFBQUksT0FBT0gsSUFBSSxDQUFDYSxPQUFaLEtBQXdCLFdBQTVCLEVBQXlDLEtB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
