import 'intersection-observer';
import 'wicg-inert';

class FixedBar {
  constructor(args) {
    this.isExpanded = false;
    this.reverse = false;
    this.revivalTimer = undefined;
    this.isClosedEternally = false;
    this.freezed = false;
    this.intersectionObserveOption = {};
    if (typeof args.bar !== 'string') throw new Error(``);
    this.bar = document.querySelector(args.bar);
    if (!this.bar) throw new Error(``);

    this._switchState(this.isExpanded);

    if (typeof args.range !== 'string') throw new Error(``);
    this.ranges = document.querySelectorAll(args.range);
    if (!this.ranges) throw new Error(``);
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
      this.close();
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

    if (typeof time === 'number' && time === 0) {
      this.isClosedEternally = true;
    } else if (typeof time === 'number' && time > 0) {
      this.revivalTimer = window.setTimeout(() => {
        window.clearTimeout(this.revivalTimer);
      }, time);
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

export default FixedBar;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLW1vZHVsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3RzL2ZpeGVkLWJhci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgJ2ludGVyc2VjdGlvbi1vYnNlcnZlcidcbmltcG9ydCAnd2ljZy1pbmVydCdcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRml4ZWRCYXIge1xuICBiYXI6IEhUTUxFbGVtZW50IHwgbnVsbFxuICByYW5nZXM6IE5vZGVMaXN0T2Y8SFRNTEVsZW1lbnQ+IHwgbnVsbFxuICBvYnNlcnZlcjogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJcbiAgaXNFeHBhbmRlZDogYm9vbGVhbiA9IGZhbHNlXG4gIHJldmVyc2U6IGJvb2xlYW4gPSBmYWxzZVxuICByZXZpdmFsVGltZXI6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuICBpc0Nsb3NlZEV0ZXJuYWxseTogYm9vbGVhbiA9IGZhbHNlXG4gIGZyZWV6ZWQ6IGJvb2xlYW4gPSBmYWxzZVxuICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0ID0ge31cblxuICBjb25zdHJ1Y3RvcihhcmdzOiB7XG4gICAgYmFyOiBzdHJpbmdcbiAgICByYW5nZTogc3RyaW5nXG4gICAgY2xvc2VyPzogc3RyaW5nXG4gICAgcmV2ZXJzZT86IGJvb2xlYW5cbiAgICBpbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uPzogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJJbml0XG4gIH0pIHtcbiAgICBpZiAodHlwZW9mIGFyZ3MuYmFyICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBgKVxuICAgIHRoaXMuYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzLmJhcilcbiAgICBpZiAoIXRoaXMuYmFyKSB0aHJvdyBuZXcgRXJyb3IoYGApXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodGhpcy5pc0V4cGFuZGVkKVxuXG4gICAgaWYgKHR5cGVvZiBhcmdzLnJhbmdlICE9PSAnc3RyaW5nJykgdGhyb3cgbmV3IEVycm9yKGBgKVxuICAgIHRoaXMucmFuZ2VzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChhcmdzLnJhbmdlKVxuICAgIGlmICghdGhpcy5yYW5nZXMpIHRocm93IG5ldyBFcnJvcihgYClcbiAgICBpZiAodHlwZW9mIGFyZ3MucmV2ZXJzZSAhPT0gJ3VuZGVmaW5lZCcpIHRoaXMucmV2ZXJzZSA9IGFyZ3MucmV2ZXJzZVxuICAgIGlmICh0eXBlb2YgYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uID0gYXJncy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uXG4gICAgfVxuXG4gICAgdGhpcy5vYnNlcnZlciA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihcbiAgICAgIHRoaXMuX29ic2VydmUuYmluZCh0aGlzKSwgdGhpcy5pbnRlcnNlY3Rpb25PYnNlcnZlT3B0aW9uKVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5yYW5nZXMubGVuZ3RoOyBpKysgKSB7XG4gICAgICB0aGlzLm9ic2VydmVyLm9ic2VydmUodGhpcy5yYW5nZXNbaV0pXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfb2JzZXJ2ZShlbnRyaWVzOiBJbnRlcnNlY3Rpb25PYnNlcnZlckVudHJ5W10pIHtcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIgfHwgdGhpcy5pc0Nsb3NlZEV0ZXJuYWxseSB8fCB0aGlzLmZyZWV6ZWQpIHJldHVyblxuXG4gICAgbGV0IGlzSW50ZXJzZWN0aW5nID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRyaWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoZW50cmllc1tpXS5pc0ludGVyc2VjdGluZykge1xuICAgICAgICBpc0ludGVyc2VjdGluZyA9IHRydWVcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKCF0aGlzLnJldmVyc2UgJiYgaXNJbnRlcnNlY3RpbmcpIHx8ICh0aGlzLnJldmVyc2UgJiYgIWlzSW50ZXJzZWN0aW5nKSkge1xuICAgICAgdGhpcy5vcGVuKClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5jbG9zZSgpXG4gICAgfVxuICB9XG5cbiAgb3BlbigpIHtcbiAgICB0aGlzLmlzRXhwYW5kZWQgPSB0cnVlXG4gICAgdGhpcy5fc3dpdGNoU3RhdGUodHJ1ZSlcbiAgICB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5ID0gZmFsc2VcbiAgICBpZiAodGhpcy5yZXZpdmFsVGltZXIpIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXZpdmFsVGltZXIpXG4gIH1cblxuICBjbG9zZSh0aW1lPzogbnVtYmVyKSB7XG4gICAgdGhpcy5pc0V4cGFuZGVkID0gZmFsc2VcbiAgICB0aGlzLl9zd2l0Y2hTdGF0ZShmYWxzZSlcbiAgICBpZiAodHlwZW9mIHRpbWUgPT09ICdudW1iZXInICYmIHRpbWUgPT09IDApIHtcbiAgICAgIHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgPSB0cnVlXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicgJiYgdGltZSA+IDApIHtcbiAgICAgIHRoaXMucmV2aXZhbFRpbWVyID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMucmV2aXZhbFRpbWVyKVxuICAgICAgfSwgdGltZSlcbiAgICB9XG4gIH1cblxuICBmcmVlemUoaXNFeHBhbmRlZDogYm9vbGVhbiA9IHRydWUpIHtcbiAgICBpc0V4cGFuZGVkID8gdGhpcy5vcGVuKCkgOiB0aGlzLmNsb3NlKClcbiAgICB0aGlzLmZyZWV6ZWQgPSB0cnVlXG4gIH1cblxuICByZXN0YXJ0KCkge1xuICAgIHRoaXMuZnJlZXplZCA9IGZhbHNlO1xuICB9XG5cbiAgcHJpdmF0ZSBfc3dpdGNoU3RhdGUoaXNFeHBhbmRlZDogYm9vbGVhbikge1xuICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGlkZGVuJywgU3RyaW5nKCFpc0V4cGFuZGVkKSlcbiAgICBpZiAoaXNFeHBhbmRlZCkge1xuICAgICAgdGhpcy5iYXI/LnJlbW92ZUF0dHJpYnV0ZSgnaGlkZGVuJylcbiAgICAgIHRoaXMuYmFyPy5yZW1vdmVBdHRyaWJ1dGUoJ2luZXJ0JylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnaGlkZGVuJywgJycpXG4gICAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdpbmVydCcsICcnKVxuICAgIH1cbiAgfVxufVxuIl0sIm5hbWVzIjpbIkZpeGVkQmFyIiwiY29uc3RydWN0b3IiLCJhcmdzIiwidW5kZWZpbmVkIiwiYmFyIiwiRXJyb3IiLCJkb2N1bWVudCIsInF1ZXJ5U2VsZWN0b3IiLCJfc3dpdGNoU3RhdGUiLCJpc0V4cGFuZGVkIiwicmFuZ2UiLCJyYW5nZXMiLCJxdWVyeVNlbGVjdG9yQWxsIiwicmV2ZXJzZSIsImludGVyc2VjdGlvbk9ic2VydmVPcHRpb24iLCJvYnNlcnZlciIsIkludGVyc2VjdGlvbk9ic2VydmVyIiwiX29ic2VydmUiLCJiaW5kIiwiaSIsImxlbmd0aCIsIm9ic2VydmUiLCJlbnRyaWVzIiwicmV2aXZhbFRpbWVyIiwiaXNDbG9zZWRFdGVybmFsbHkiLCJmcmVlemVkIiwiaXNJbnRlcnNlY3RpbmciLCJvcGVuIiwiY2xvc2UiLCJ3aW5kb3ciLCJjbGVhclRpbWVvdXQiLCJ0aW1lIiwic2V0VGltZW91dCIsImZyZWV6ZSIsInJlc3RhcnQiLCJzZXRBdHRyaWJ1dGUiLCJTdHJpbmciLCJyZW1vdmVBdHRyaWJ1dGUiXSwibWFwcGluZ3MiOiI7OztNQUdxQkE7QUFXbkJDLEVBQUFBLFlBQVlDO0FBUFosbUJBQUEsR0FBc0IsS0FBdEI7QUFDQSxnQkFBQSxHQUFtQixLQUFuQjtBQUNBLHFCQUFBLEdBQW1DQyxTQUFuQztBQUNBLDBCQUFBLEdBQTZCLEtB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
