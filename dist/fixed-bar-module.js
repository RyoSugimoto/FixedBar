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

export default FixedBar;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZml4ZWQtYmFyLW1vZHVsZS5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL3RzL2ZpeGVkLWJhci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZGVmYXVsdCBjbGFzcyBGaXhlZEJhciB7XG4gIGJhcjogSFRNTEVsZW1lbnQgfCBudWxsXG4gIHJhbmdlczogTm9kZUxpc3RPZjxIVE1MRWxlbWVudD4gfCBudWxsXG4gIG9ic2VydmVyOiBJbnRlcnNlY3Rpb25PYnNlcnZlclxuICBpc0V4cGFuZGVkOiBib29sZWFuID0gZmFsc2VcbiAgcmV2ZXJzZTogYm9vbGVhbiA9IGZhbHNlXG4gIHJldml2YWxUaW1lcjogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG4gIGlzQ2xvc2VkRXRlcm5hbGx5OiBib29sZWFuID0gZmFsc2VcbiAgZnJlZXplZDogYm9vbGVhbiA9IGZhbHNlXG4gIGludGVyc2VjdGlvbk9ic2VydmVPcHRpb24/OiBJbnRlcnNlY3Rpb25PYnNlcnZlckluaXQgPSB7fVxuXG4gIGNvbnN0cnVjdG9yKGFyZ3M6IHtcbiAgICBiYXI6IHN0cmluZ1xuICAgIHJhbmdlOiBzdHJpbmdcbiAgICBjbG9zZXI/OiBzdHJpbmdcbiAgICByZXZlcnNlPzogYm9vbGVhblxuICAgIGludGVyc2VjdGlvbk9ic2VydmVPcHRpb24/OiBJbnRlcnNlY3Rpb25PYnNlcnZlckluaXRcbiAgfSkge1xuICAgIGlmICh0eXBlb2YgYXJncy5iYXIgIT09ICdzdHJpbmcnKSB0aHJvdyBuZXcgRXJyb3IoYEZpeGVkQmFyOiBUaGUgcHJvcGVydHkgJ2JhcicgbXVzdCBiZSByZXF1aXJlZC5gKVxuICAgIHRoaXMuYmFyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihhcmdzLmJhcilcbiAgICBpZiAoIXRoaXMuYmFyKSB0aHJvdyBuZXcgRXJyb3IoYEZpeGVkQmFyOiBUaGUgRWxlbWVudCBkb2Vzbid0IGV4aXN0LmApXG4gICAgdGhpcy5iYXIuc2V0QXR0cmlidXRlKCdkYXRhLWZpeGVkLWJhcicsICcnKVxuICAgIHRoaXMuX3N3aXRjaFN0YXRlKHRoaXMuaXNFeHBhbmRlZClcblxuICAgIGlmICh0eXBlb2YgYXJncy5yYW5nZSAhPT0gJ3N0cmluZycpIHRocm93IG5ldyBFcnJvcihgRml4ZWRCYXI6IFRoZSBwcm9wZXJ0eSAncmFuZ2UnIG11c3QgYmUgcmVxdWlyZWQuYClcbiAgICB0aGlzLnJhbmdlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoYXJncy5yYW5nZSlcbiAgICBpZiAoIXRoaXMucmFuZ2VzIHx8IHRoaXMucmFuZ2VzLmxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKGBGaXhlZEJhcjogVGhlIHJhbmdlIGVsZW1lbnQgaXMgbm90IGZvdW5kLmApXG4gICAgaWYgKHR5cGVvZiBhcmdzLnJldmVyc2UgIT09ICd1bmRlZmluZWQnKSB0aGlzLnJldmVyc2UgPSBhcmdzLnJldmVyc2VcbiAgICBpZiAodHlwZW9mIGFyZ3MuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHRoaXMuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbiA9IGFyZ3MuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvblxuICAgIH1cblxuICAgIHRoaXMub2JzZXJ2ZXIgPSBuZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoXG4gICAgICB0aGlzLl9vYnNlcnZlLmJpbmQodGhpcyksIHRoaXMuaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbilcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMucmFuZ2VzLmxlbmd0aDsgaSsrICkge1xuICAgICAgdGhpcy5vYnNlcnZlci5vYnNlcnZlKHRoaXMucmFuZ2VzW2ldKVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX29ic2VydmUoZW50cmllczogSW50ZXJzZWN0aW9uT2JzZXJ2ZXJFbnRyeVtdKSB7XG4gICAgaWYgKHRoaXMucmV2aXZhbFRpbWVyIHx8IHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgfHwgdGhpcy5mcmVlemVkKSByZXR1cm5cblxuICAgIGxldCBpc0ludGVyc2VjdGluZyA9IGZhbHNlO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW50cmllcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKGVudHJpZXNbaV0uaXNJbnRlcnNlY3RpbmcpIHtcbiAgICAgICAgaXNJbnRlcnNlY3RpbmcgPSB0cnVlXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCghdGhpcy5yZXZlcnNlICYmIGlzSW50ZXJzZWN0aW5nKSB8fCAodGhpcy5yZXZlcnNlICYmICFpc0ludGVyc2VjdGluZykpIHtcbiAgICAgIHRoaXMub3BlbigpXG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuY2xvc2UoMClcbiAgICB9XG4gIH1cblxuICBvcGVuKCkge1xuICAgIHRoaXMuaXNFeHBhbmRlZCA9IHRydWVcbiAgICB0aGlzLl9zd2l0Y2hTdGF0ZSh0cnVlKVxuICAgIHRoaXMuaXNDbG9zZWRFdGVybmFsbHkgPSBmYWxzZVxuICAgIGlmICh0aGlzLnJldml2YWxUaW1lcikgd2luZG93LmNsZWFyVGltZW91dCh0aGlzLnJldml2YWxUaW1lcilcbiAgfVxuXG4gIGNsb3NlKHRpbWU/OiBudW1iZXIpIHtcbiAgICB0aGlzLmlzRXhwYW5kZWQgPSBmYWxzZVxuICAgIHRoaXMuX3N3aXRjaFN0YXRlKGZhbHNlKVxuICAgIGlmICh0eXBlb2YgdGltZSA9PT0gJ251bWJlcicgJiYgdGltZSA9PT0gMCkge1xuICAgICAgLy9cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aW1lID09PSAnbnVtYmVyJyAmJiB0aW1lID4gMCkge1xuICAgICAgdGhpcy5yZXZpdmFsVGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5yZXZpdmFsVGltZXIpXG4gICAgICAgIHRoaXMucmV2aXZhbFRpbWVyID0gdW5kZWZpbmVkXG4gICAgICB9LCB0aW1lKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmlzQ2xvc2VkRXRlcm5hbGx5ID0gdHJ1ZVxuICAgIH1cbiAgfVxuXG4gIGZyZWV6ZShpc0V4cGFuZGVkOiBib29sZWFuID0gdHJ1ZSkge1xuICAgIGlzRXhwYW5kZWQgPyB0aGlzLm9wZW4oKSA6IHRoaXMuY2xvc2UoKVxuICAgIHRoaXMuZnJlZXplZCA9IHRydWVcbiAgfVxuXG4gIHJlc3RhcnQoKSB7XG4gICAgdGhpcy5mcmVlemVkID0gZmFsc2U7XG4gIH1cblxuICBwcml2YXRlIF9zd2l0Y2hTdGF0ZShpc0V4cGFuZGVkOiBib29sZWFuKSB7XG4gICAgdGhpcy5iYXI/LnNldEF0dHJpYnV0ZSgnYXJpYS1oaWRkZW4nLCBTdHJpbmcoIWlzRXhwYW5kZWQpKVxuICAgIGlmIChpc0V4cGFuZGVkKSB7XG4gICAgICB0aGlzLmJhcj8ucmVtb3ZlQXR0cmlidXRlKCdoaWRkZW4nKVxuICAgICAgdGhpcy5iYXI/LnJlbW92ZUF0dHJpYnV0ZSgnaW5lcnQnKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmJhcj8uc2V0QXR0cmlidXRlKCdoaWRkZW4nLCAnJylcbiAgICAgIHRoaXMuYmFyPy5zZXRBdHRyaWJ1dGUoJ2luZXJ0JywgJycpXG4gICAgfVxuICB9XG59XG4iXSwibmFtZXMiOlsiRml4ZWRCYXIiLCJjb25zdHJ1Y3RvciIsImFyZ3MiLCJ1bmRlZmluZWQiLCJiYXIiLCJFcnJvciIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsInNldEF0dHJpYnV0ZSIsIl9zd2l0Y2hTdGF0ZSIsImlzRXhwYW5kZWQiLCJyYW5nZSIsInJhbmdlcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJsZW5ndGgiLCJyZXZlcnNlIiwiaW50ZXJzZWN0aW9uT2JzZXJ2ZU9wdGlvbiIsIm9ic2VydmVyIiwiSW50ZXJzZWN0aW9uT2JzZXJ2ZXIiLCJfb2JzZXJ2ZSIsImJpbmQiLCJpIiwib2JzZXJ2ZSIsImVudHJpZXMiLCJyZXZpdmFsVGltZXIiLCJpc0Nsb3NlZEV0ZXJuYWxseSIsImZyZWV6ZWQiLCJpc0ludGVyc2VjdGluZyIsIm9wZW4iLCJjbG9zZSIsIndpbmRvdyIsImNsZWFyVGltZW91dCIsInRpbWUiLCJzZXRUaW1lb3V0IiwiZnJlZXplIiwicmVzdGFydCIsIlN0cmluZyIsInJlbW92ZUF0dHJpYnV0ZSJdLCJtYXBwaW5ncyI6Ik1BQXFCQTtBQVduQkMsRUFBQUEsWUFBWUM7QUFQWixtQkFBQSxHQUFzQixLQUF0QjtBQUNBLGdCQUFBLEdBQW1CLEtBQW5CO0FBQ0EscUJBQUEsR0FBbUNDLFNBQW5DO0FBQ0EsMEJBQUEsR0FBNkIsS0FBN0I7QUFDQSxnQkFBQSxHQUFtQixLQUFuQjtBQUNBLGtDQUFBLEdBQXVELEVBQXZEO0FBU0UsUUFBSSxPQUFPRCxJQUFJLENBQUNFLEdBQVosS0FBb0IsUUFBeEIsRUFBa0MsTUFBTSxJQUFJQyxLQUFKLGlEQUFBLENBQU47QUFDbEMsU0FBS0QsR0FBTCxHQUFXRSxRQUFRLENBQUNDLGFBQVQsQ0FBdUJMLElBQUksQ0FBQ0UsR0FBNUIsQ0FBWDtBQUNBLFFBQUksQ0FBQyxLQUFLQSxHQUFWLEVBQWUsTUFBTSxJQUFJQyxLQUFKLHVDQUFBLENBQU47QUFDZixTQUFLRCxHQUFMLENBQVNJLFlBQVQsQ0FBc0IsZ0JBQXRCLEVBQXdDLEVBQXhDOztBQUNBLFNBQUtDLFlBQUwsQ0FBa0IsS0FBS0MsVUFBdkI7O0FBRUEsUUFBSSxPQUFPUixJQUFJLENBQUNTLEtBQVosS0FBc0IsUUFBMUIsRUFBb0MsTUFBTSxJQUFJTixLQUFKLG1EQUFBLENBQU47QUFDcEMsU0FBS08sTUFBTCxHQUFjTixRQUFRLENBQUNPLGdCQUFULENBQTBCWCxJQUFJLENBQUNTLEtBQS9CLENBQWQ7QUFDQSxRQUFJLENBQUMsS0FBS0MsTUFBTixJQUFnQixLQUFLQSxNQUFMLENBQVlFLE1BQVosS0FBdUIsQ0FBM0MsRUFBOEMsTUFBTSxJQUFJVCxLQUFKLDRDQUFBLENBQU47QUFDOUMsUUFBSSxPQUFPSCxJQUFJLENBQUNhLE9BQVosS0FBd0IsV0FBNUIsRUFBeUMsS0FBS0EsT0FBTCxHQUFlYixJQUFJLENBQUNhLE9BQXBCOztBQUN6QyxRQUFJLE9BQU9iLElBQUksQ0FBQ2MseUJBQVosS0FBMEMsV0FBOUMsRUFBMkQ7QUFDekQsV0FBS0EseUJBQUwsR0FBaUNkLElBQUksQ0FBQ2MseUJBQXRDO0FBQ0Q7O0FBRUQsU0FBS0MsUUFBTCxHQUFnQixJQUFJQyxvQkFBSixDQUNkLEtBQUtDLFFBQUwsQ0FBY0MsSUFBZCxDQUFtQixJQUFuQixDQURjLEVBQ1ksS0FBS0oseUJBRGpCLENBQWhCOztBQUVBLFNBQUssSUFBSUssQ0FBQyxHQUFHLENBQWIsRUFBZ0JBLENBQUMsR0FBRyxLQUFLVCxNQUFMLENBQVlFLE1BQWhDLEVBQXdDTyxDQUFDLEVBQXpDLEVBQThDO0FBQzVDLFdBQUtKLFFBQUwsQ0FBY0ssT0FBZCxDQUFzQixLQUFLVixNQUFMLENBQVlTLENBQVosQ0FBdEI7QUFDRDtBQUNGOztBQUVPRixFQUFBQSxRQUFRLENBQUNJLE9BQUQ7QUFDZCxRQUFJLEtBQUtDLFlBQUwsSUFBcUIsS0FBS0MsaUJBQTFCLElBQStDLEtBQUtDLE9BQXhELEVBQWlFO0FBRWpFLFFBQUlDLGNBQWMsR0FBRyxLQUFyQjs7QUFDQSxTQUFLLElBQUlOLENBQUMsR0FBRyxDQUFiLEVBQWdCQSxDQUFDLEdBQUdFLE9BQU8sQ0FBQ1QsTUFBNUIsRUFBb0NPLENBQUMsRUFBckMsRUFBeUM7QUFDdkMsVUFBSUUsT0FBTyxDQUFDRixDQUFELENBQVAsQ0FBV00sY0FBZixFQUErQjtBQUM3QkEsUUFBQUEsY0FBYyxHQUFHLElBQWpCO0FBQ0E7QUFDRDtBQUNGOztBQUVELFFBQUssQ0FBQyxLQUFLWixPQUFOLElBQWlCWSxjQUFsQixJQUFzQyxLQUFLWixPQUFMLElBQWdCLENBQUNZLGNBQTNELEVBQTRFO0FBQzFFLFdBQUtDLElBQUw7QUFDRCxLQUZELE1BRU87QUFDTCxXQUFLQyxLQUFMLENBQVcsQ0FBWDtBQUNEO0FBQ0Y7O0FBRURELEVBQUFBLElBQUk7QUFDRixTQUFLbEIsVUFBTCxHQUFrQixJQUFsQjs7QUFDQSxTQUFLRCxZQUFMLENBQWtCLElBQWxCOztBQUNBLFNBQUtnQixpQkFBTCxHQUF5QixLQUF6QjtBQUNBLFFBQUksS0FBS0QsWUFBVCxFQUF1Qk0sTUFBTSxDQUFDQyxZQUFQLENBQW9CLEtBQUtQLFlBQXpCO0FBQ3hCOztBQUVESyxFQUFBQSxLQUFLLENBQUNHLElBQUQ7QUFDSCxTQUFLdEIsVUFBTCxHQUFrQixLQUFsQjs7QUFDQSxTQUFLRCxZQUFMLENBQWtCLEtBQWxCOztBQUNBLFFBQUksT0FBT3VCLElBQVAsS0FBZ0IsUUFBaEIsSUFBNEJBLElBQUksS0FBSyxDQUF6QyxFQUE0QyxDQUE1QyxNQUVPLElBQUksT0FBT0EsSUFBUCxLQUFnQixRQUFoQixJQUE0QkEsSUFBSSxHQUFHLENBQXZDLEVBQTBDO0FBQy9DLFdBQUtSLFlBQUwsR0FBb0JNLE1BQU0sQ0FBQ0csVUFBUCxDQUFrQjtBQUNwQ0gsUUFBQUEsTUFBTSxDQUFDQyxZQUFQLENBQW9CLEtBQUtQLFlBQXpCO0FBQ0EsYUFBS0EsWUFBTCxHQUFvQnJCLFNBQXBCO0FBQ0QsT0FIbUIsRUFHakI2QixJQUhpQixDQUFwQjtBQUlELEtBTE0sTUFLQTtBQUNMLFdBQUtQLGlCQUFMLEdBQXlCLElBQXpCO0FBQ0Q7QUFDRjs7QUFFRFMsRUFBQUEsTUFBTSxDQUFDeEIsYUFBc0IsSUFBdkI7QUFDSkEsSUFBQUEsVUFBVSxHQUFHLEtBQUtrQixJQUFMLEVBQUgsR0FBaUIsS0FBS0MsS0FBTCxFQUEzQjtBQUNBLFNBQUtILE9BQUwsR0FBZSxJQUFmO0FBQ0Q7O0FBRURTLEVBQUFBLE9BQU87QUFDTCxTQUFLVCxPQUFMLEdBQWUsS0FBZjtBQUNEOztBQUVPakIsRUFBQUEsWUFBWSxDQUFDQyxVQUFEOzs7QUFDbEIsc0JBQUtOLEdBQUwsd0RBQVVJLFlBQVYsQ0FBdUIsYUFBdkIsRUFBc0M0QixNQUFNLENBQUMsQ0FBQzFCLFVBQUYsQ0FBNUM7O0FBQ0EsUUFBSUEsVUFBSixFQUFnQjtBQUFBOztBQUNkLHlCQUFLTixHQUFMLDBEQUFVaUMsZUFBVixDQUEwQixRQUExQjtBQUNBLHlCQUFLakMsR0FBTCwwREFBVWlDLGVBQVYsQ0FBMEIsT0FBMUI7QUFDRCxLQUhELE1BR087QUFBQTs7QUFDTCx5QkFBS2pDLEdBQUwsMERBQVVJLFlBQVYsQ0FBdUIsUUFBdkIsRUFBaUMsRUFBakM7QUFDQSx5QkFBS0osR0FBTCwwREFBVUksWUFBVixDQUF1QixPQUF2QixFQUFnQyxFQUFoQztBQUNEO0FBQ0Y7Ozs7OzsifQ==
