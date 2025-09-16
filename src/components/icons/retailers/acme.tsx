import { IconProps } from '../types'

export function AcmeIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 209.25 66.25"
      fill="none"
      className={className}
      {...props}
    >
      <g>
        <path
          d="m75.25,0s-9.75,1.75-11.75,14-6.5,43-6.5,43c0,0,1.5,9.25,9.12,9.25h26.62l2.75-19-16.25-.25s-3.5-1-3-4,3.5-19.25,3.5-19.25c0,0,0-3.25,4.75-3.25s16,.25,16,.25l3.5-20.75h-28.75Z"
          fill="currentColor"
        />
        <path
          d="m24,1.25L0,66.25h17.75l3.5-9.25h12.75v9.25h17.75V1.25h-27.75Zm10,36.5h-6.38l6.38-14v14Z"
          fill="currentColor"
        />
        <polygon
          points="122.75 41 122.75 66.25 133.25 66.25 142.25 41 137.25 66.25 153.25 66.25 166 0 143.5 0 133.25 24.75 133.25 0 112.25 0 99.25 66.25 117 66.25 122.75 41"
          fill="currentColor"
        />
        <polygon
          points="200.25 45.75 182.5 45.75 184.25 39 201.75 39 204.5 24.75 186.5 24.75 188 19 206 19 209.25 0 173.5 0 161.5 66.25 197 66.25 200.25 45.75"
          fill="currentColor"
        />
      </g>
    </svg>
  )
} 