import * as React from 'react'

const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>( (props, ref) => {
  return <input type='checkbox' ref={ref} {...props} className={'h-4 w-4 shrink-0 rounded-sm border border-slate-200 border-slate-900 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ' + (props.className || '')} />
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
