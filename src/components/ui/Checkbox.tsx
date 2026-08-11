interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  title?: string
}

export function Checkbox(props: CheckboxProps) {
  return (
    <label className='checkbox' title={props.title}>
      <input
        type='checkbox'
        checked={props.checked}
        onChange={function (e) { props.onChange(e.target.checked) }}
      />
      <span className='checkbox-box'>{props.checked ? '✓' : ''}</span>
      {props.label ? <span className='checkbox-label'>{props.label}</span> : null}
    </label>
  )
}
