const debounce = fn => {
  let timeout
  return (...args) => {
    window.cancelAnimationFrame(timeout)
    timeout = window.requestAnimationFrame(() => fn.apply(this, args))
  }
}
