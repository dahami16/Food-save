import './PlaceholderPage.css'

/**
 * TEMPORARY Stage 1 placeholder for unfinished routes.
 *
 * Each route passes a `title` so the router can be verified
 * end-to-end before the real pages exist. Real pages will be
 * created one by one at their own file locations in later
 * stages and will replace these placeholders route by route.
 *
 * Do not use this component for any final page.
 */
function PlaceholderPage({ title }) {
  return (
    <main className="placeholder-page">
      <h1 className="placeholder-page__title">{title}</h1>
      <p className="placeholder-page__hint">
        Placeholder route — this page will be implemented in a later stage.
      </p>
    </main>
  )
}

export default PlaceholderPage