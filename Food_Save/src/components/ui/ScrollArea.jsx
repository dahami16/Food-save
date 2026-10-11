import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area'
import './ScrollArea.css'

/**
 * ScrollArea — 21st.dev Scroll Area component, adapted from the
 * provided 21st.dev prompt for the existing React JavaScript +
 * plain CSS project.
 *
 * Original 21st.dev source: scroll-area.tsx (TypeScript + Tailwind,
 * className composition via cn() from lib/utils).
 *
 * Adaptations for Food Save (behaviour preserved):
 *   - TypeScript-only syntax removed (no generics/type annotations)
 *   - Tailwind utility classes replaced with semantic plain-CSS
 *     classes in ScrollArea.css
 *   - cn() replaced with a tiny local cx() helper
 *   - Default export to match this project's component convention
 *
 * The Base UI implementation is preserved unchanged:
 *   ScrollAreaPrimitive.Root / Viewport / Scrollbar / Thumb / Corner
 *   (imported from '@base-ui/react/scroll-area', per the 21st.dev prompt)
 *
 * Reusability rules:
 *   - Renders `children` only; no page-specific data, text or logic.
 *   - Sizing (height/width) is controlled by the parent page through
 *     `className`; never hard-coded here.
 *   - `orientation` defaults to "vertical"; pass "horizontal" for
 *     horizontal lists (same API as the 21st.dev component).
 */
const cx = (...classes) => classes.filter(Boolean).join(' ')

function ScrollArea({ className, orientation = 'vertical', children, ...props }) {
  return (
    <ScrollAreaPrimitive.Root
      className={cx('food-scroll-area', className)}
      data-orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport className="food-scroll-area__viewport">
        {children}
      </ScrollAreaPrimitive.Viewport>

      <ScrollAreaPrimitive.Scrollbar
        orientation={orientation}
        className="food-scroll-area__scrollbar"
      >
        <ScrollAreaPrimitive.Thumb className="food-scroll-area__thumb" />
      </ScrollAreaPrimitive.Scrollbar>

      <ScrollAreaPrimitive.Corner className="food-scroll-area__corner" />
    </ScrollAreaPrimitive.Root>
  )
}

export default ScrollArea
