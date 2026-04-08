import { test, expect } from '@playwright/test'

// Helper: select the main content area (excludes sidebar)
const main = 'main, [class*="p-8"]'

// ---------------------------------------------------------------------------
// Accounts page
// ---------------------------------------------------------------------------
test.describe('Accounts page', () => {
  test('loads and renders account list', async ({ page }) => {
    await page.goto('/accounts')
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
  })

  test('filters work (Type, Priority, Owner, Region)', async ({ page }) => {
    await page.goto('/accounts')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })

    // Type filter exists and has options
    const typeSelect = page.locator('select').filter({ hasText: 'All Types' })
    await expect(typeSelect).toBeVisible()
    await typeSelect.selectOption({ index: 1 })
    // After filtering, the page should still be functional
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()

    // Reset type filter
    await typeSelect.selectOption('')

    // Priority filter
    const prioritySelect = page.locator('select').filter({ hasText: 'All Priorities' })
    await expect(prioritySelect).toBeVisible()

    // Owner filter
    const ownerSelect = page.locator('select').filter({ hasText: 'All Owners' })
    await expect(ownerSelect).toBeVisible()

    // Region filter
    const regionSelect = page.locator('select').filter({ hasText: 'All Regions' })
    await expect(regionSelect).toBeVisible()
  })

  test('Add Account form opens with all fields including Level', async ({ page }) => {
    await page.goto('/accounts')
    await page.getByRole('button', { name: 'Add Account' }).click()

    const modal = page.locator('[class*="fixed"]').filter({ hasText: 'Add Account' })
    await expect(modal).toBeVisible()

    // Check key form fields are present
    await expect(modal.locator('label').filter({ hasText: 'Name' })).toBeVisible()
    await expect(modal.locator('label').filter({ hasText: 'Type' })).toBeVisible()
    await expect(modal.locator('label').filter({ hasText: 'Level' })).toBeVisible()
    await expect(modal.locator('label').filter({ hasText: 'Region' })).toBeVisible()
    await expect(modal.locator('label').filter({ hasText: 'Priority' })).toBeVisible()
    await expect(modal.locator('label').filter({ hasText: 'Owner' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Tasks page
// ---------------------------------------------------------------------------
test.describe('Tasks page', () => {
  test('loads and renders tasks', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
  })

  test('status filter shows all four statuses', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })

    // Open the status dropdown
    const statusButton = page.getByRole('button').filter({ hasText: /Status/ })
    await statusButton.click()

    // The dropdown checkboxes are inside labels within a dropdown div near the button
    const dropdown = page.locator('div[class*="absolute"]').filter({ hasText: 'Not Started' }).filter({ hasText: 'Blocked' })
    await expect(dropdown.locator('label').filter({ hasText: 'Not Started' })).toBeVisible()
    await expect(dropdown.locator('label').filter({ hasText: 'In Progress' })).toBeVisible()
    await expect(dropdown.locator('label').filter({ hasText: 'Blocked' })).toBeVisible()
    await expect(dropdown.locator('label').filter({ hasText: 'Complete' })).toBeVisible()
  })

  test('click into task detail page', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })

    // Click the first task title link
    const firstTaskLink = page.locator('tbody tr').first().locator('a').first()
    await firstTaskLink.click()

    // Should be on the detail page with Back to Tasks link
    await expect(page.getByText('Back to Tasks')).toBeVisible({ timeout: 10_000 })
    // Key fields (uppercase labels on the detail page)
    await expect(page.getByText('ASSIGNEE')).toBeVisible()
    await expect(page.getByText('DUE DATE')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
test.describe('Dashboard', () => {
  test('loads with all sections', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Stat cards should render (use heading role to avoid duplicates with stat card labels)
    await expect(page.getByRole('heading', { name: 'Overdue Follow-ups' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Overdue Tasks' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Due This Week' })).toBeVisible()
    await expect(page.getByText('Total Accounts')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------
test.describe('Regions', () => {
  test('list loads and can navigate to detail', async ({ page }) => {
    await page.goto('/regions')
    await expect(page.getByRole('heading', { name: 'Regions' })).toBeVisible()

    // Wait for region cards/links to appear
    const firstRegionLink = page.locator('a[href^="/regions/"]').first()
    await expect(firstRegionLink).toBeVisible({ timeout: 15_000 })
    await firstRegionLink.click()

    // Region detail page
    await expect(page.getByText('Back to Regions')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Region Info')).toBeVisible()
    await expect(page.getByText('Goal SY26')).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Funders tab
// ---------------------------------------------------------------------------
test.describe('Funders', () => {
  test('page loads and renders funder list', async ({ page }) => {
    await page.goto('/accounts/funders')
    await expect(page.getByRole('heading', { name: 'Funders' })).toBeVisible()
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 15_000 })
  })
})
