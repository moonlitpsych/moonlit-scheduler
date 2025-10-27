/**
 * Hook for resizable table columns
 * Allows users to drag column borders to resize widths
 */

import { useState, useCallback, useEffect, useRef } from 'react'

interface ColumnWidths {
  [key: string]: number
}

export function useResizableColumns(
  tableId: string,
  defaultWidths: ColumnWidths
) {
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${tableId}-column-widths`)
      if (stored) {
        try {
          return JSON.parse(stored)
        } catch {
          return defaultWidths
        }
      }
    }
    return defaultWidths
  })

  const [activeColumn, setActiveColumn] = useState<string | null>(null)
  const [startX, setStartX] = useState<number>(0)
  const [startWidth, setStartWidth] = useState<number>(0)

  // Save to localStorage whenever widths change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${tableId}-column-widths`, JSON.stringify(columnWidths))
    }
  }, [columnWidths, tableId])

  const handleMouseDown = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    setActiveColumn(columnKey)
    setStartX(e.clientX)
    setStartWidth(columnWidths[columnKey] || 150)
  }, [columnWidths])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeColumn) return

    const diff = e.clientX - startX
    const newWidth = Math.max(80, startWidth + diff) // Minimum 80px

    setColumnWidths(prev => ({
      ...prev,
      [activeColumn]: newWidth
    }))
  }, [activeColumn, startX, startWidth])

  const handleMouseUp = useCallback(() => {
    setActiveColumn(null)
  }, [])

  useEffect(() => {
    if (activeColumn) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [activeColumn, handleMouseMove, handleMouseUp])

  const resetWidths = useCallback(() => {
    setColumnWidths(defaultWidths)
  }, [defaultWidths])

  return {
    columnWidths,
    handleMouseDown,
    resetWidths,
    isResizing: !!activeColumn
  }
}
