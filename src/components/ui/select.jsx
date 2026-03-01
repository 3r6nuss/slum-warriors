import * as React from "react"
import { cn } from "@/lib/utils"

const Select = React.forwardRef(({ className, children, value, onValueChange, ...props }, ref) => {
    return (
        <select
            ref={ref}
            value={value}
            onChange={(e) => onValueChange?.(e.target.value)}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer transition-colors duration-200",
                className
            )}
            {...props}
        >
            {children}
        </select>
    )
})
Select.displayName = "Select"

const SelectOption = React.forwardRef(({ className, ...props }, ref) => (
    <option ref={ref} className={cn("bg-popover text-popover-foreground", className)} {...props} />
))
SelectOption.displayName = "SelectOption"

export { Select, SelectOption }
