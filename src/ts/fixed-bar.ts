import 'intersection-observer'
import 'wicg-inert'

export default class FixedBar {
  bar: HTMLElement | null
  ranges: NodeListOf<HTMLElement> | null
  observer: IntersectionObserver
  isExpanded: boolean = false
  reverse: boolean = false
  revivalTimer: number | undefined = undefined
  isClosedEternally: boolean = false
  freezed: boolean = false
  intersectionObserveOption?: IntersectionObserverInit = {}

  constructor(args: {
    bar: string
    range: string
    closer?: string
    reverse?: boolean
    intersectionObserveOption?: IntersectionObserverInit
  }) {
    if (typeof args.bar !== 'string') throw new Error(`FixedBar: The property 'bar' must be required.`)
    this.bar = document.querySelector(args.bar)
    if (!this.bar) throw new Error(`FixedBar: The Element doesn't exist.`)
    this.bar.setAttribute('data-fixed-bar', '')
    this._switchState(this.isExpanded)

    if (typeof args.range !== 'string') throw new Error(`FixedBar: The property 'range' must be required.`)
    this.ranges = document.querySelectorAll(args.range)
    if (!this.ranges || this.ranges.length === 0) throw new Error(`FixedBar: The range element is not found.`)
    if (typeof args.reverse !== 'undefined') this.reverse = args.reverse
    if (typeof args.intersectionObserveOption !== 'undefined') {
      this.intersectionObserveOption = args.intersectionObserveOption
    }

    this.observer = new IntersectionObserver(
      this._observe.bind(this), this.intersectionObserveOption)
    for (let i = 0; i < this.ranges.length; i++ ) {
      this.observer.observe(this.ranges[i])
    }
  }

  private _observe(entries: IntersectionObserverEntry[]) {
    if (this.revivalTimer || this.isClosedEternally || this.freezed) return

    let isIntersecting = false;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        isIntersecting = true
        break
      }
    }

    if ((!this.reverse && isIntersecting) || (this.reverse && !isIntersecting)) {
      this.open()
    } else {
      this.close(0)
    }
  }

  open() {
    this.isExpanded = true
    this._switchState(true)
    this.isClosedEternally = false
    if (this.revivalTimer) window.clearTimeout(this.revivalTimer)
  }

  close(time?: number) {
    this.isExpanded = false
    this._switchState(false)
    if (typeof time === 'number' && time === 0) {
      //
    } else if (typeof time === 'number' && time > 0) {
      this.revivalTimer = window.setTimeout(() => {
        window.clearTimeout(this.revivalTimer)
        this.revivalTimer = undefined
      }, time)
    } else {
      this.isClosedEternally = true
    }
  }

  freeze(isExpanded: boolean = true) {
    isExpanded ? this.open() : this.close()
    this.freezed = true
  }

  restart() {
    this.freezed = false;
  }

  private _switchState(isExpanded: boolean) {
    this.bar?.setAttribute('aria-hidden', String(!isExpanded))
    if (isExpanded) {
      this.bar?.removeAttribute('hidden')
      this.bar?.removeAttribute('inert')
    } else {
      this.bar?.setAttribute('hidden', '')
      this.bar?.setAttribute('inert', '')
    }
  }
}
