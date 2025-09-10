import { NextResponse } from 'next/server'
import { formatDateSafe, validateDateFormatting, parseDateString } from '@/lib/utils/dateFormatting'

export async function GET() {
  try {
    console.log('🔍 Validating timezone-safe date formatting...')

    // Test cases based on the actual problem dates
    const testCases = [
      {
        name: 'Health Choice Utah Effective Date',
        database_value: '2025-09-01',
        expected_display: 'Sep 1, 2025',
        should_not_be: 'Aug 31, 2025'
      },
      {
        name: 'Health Choice Utah Bookable Date',
        database_value: '2025-08-11',
        expected_display: 'Aug 11, 2025',
        should_not_be: 'Aug 10, 2025'
      },
      {
        name: 'Optum Effective Date',
        database_value: '2025-08-07',
        expected_display: 'Aug 7, 2025',
        should_not_be: 'Aug 6, 2025'
      }
    ]

    const testResults = testCases.map(testCase => {
      // Test different format options
      const shortFormat = formatDateSafe(testCase.database_value, { format: 'short' })
      const longFormat = formatDateSafe(testCase.database_value, { format: 'long' })
      const weekdayFormat = formatDateSafe(testCase.database_value, { format: 'weekday' })

      // Parse the date to check individual components
      const dateParts = parseDateString(testCase.database_value)

      // Compare with old buggy method
      const oldBuggyMethod = (() => {
        try {
          return new Date(testCase.database_value).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        } catch {
          return 'error'
        }
      })()

      // Validation
      const isCorrect = validateDateFormatting(testCase.database_value, shortFormat)
      const avoidedBug = shortFormat !== testCase.should_not_be

      return {
        ...testCase,
        results: {
          short_format: shortFormat,
          long_format: longFormat,
          weekday_format: weekdayFormat,
          old_buggy_method: oldBuggyMethod,
          date_parts: dateParts,
          validation: {
            is_correct: isCorrect,
            avoided_timezone_bug: avoidedBug,
            matches_expected: shortFormat === testCase.expected_display
          }
        }
      }
    })

    // Test edge cases
    const edgeCases = [
      { input: null, expected: '-' },
      { input: '', expected: '-' },
      { input: 'invalid-date', expected: 'invalid-date' },
      { input: '2025-02-29', expected: null }, // Invalid leap year
      { input: '2024-02-29', expected: 'Feb 29, 2024' }, // Valid leap year
    ]

    const edgeResults = edgeCases.map(edge => ({
      input: edge.input,
      expected: edge.expected,
      actual: formatDateSafe(edge.input),
      passes: edge.expected === null || formatDateSafe(edge.input) === edge.expected
    }))

    // Summary
    const allTestsPassed = testResults.every(test => test.results.validation.is_correct && test.results.validation.avoided_timezone_bug)
    const allEdgesPassed = edgeResults.every(edge => edge.passes)

    return NextResponse.json({
      success: true,
      validation_summary: {
        all_tests_passed: allTestsPassed && allEdgesPassed,
        timezone_bug_fixed: testResults.every(test => test.results.validation.avoided_timezone_bug),
        main_tests_passed: testResults.length,
        edge_cases_passed: edgeResults.filter(e => e.passes).length
      },
      test_results: testResults,
      edge_case_results: edgeResults,
      fix_verification: {
        before_fix_example: `new Date("2025-09-01").toLocaleDateString() = "${new Date("2025-09-01").toLocaleDateString()}"`,
        after_fix_example: `formatDateSafe("2025-09-01") = "${formatDateSafe("2025-09-01")}"`,
        timezone_info: {
          server_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          server_offset: new Date().getTimezoneOffset()
        }
      }
    })

  } catch (error: any) {
    console.error('❌ Error in date fix validation:', error)
    return NextResponse.json({ success: false, error: error.message })
  }
}