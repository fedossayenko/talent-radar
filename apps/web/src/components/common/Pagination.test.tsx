import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from './Pagination'

describe('Pagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    onPageChange: vi.fn(),
    pageSize: 20,
    onPageSizeChange: vi.fn(),
    totalItems: 200,
    isLoading: false,
  }

  it('renders pagination component', () => {
    render(<Pagination {...defaultProps} />)
    
    // Check pagination info section exists
    expect(document.querySelector('.pagination-info')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
    // Check pagination buttons exist
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('calls onPageChange when page is changed', () => {
    const mockOnPageChange = vi.fn()
    render(<Pagination {...defaultProps} onPageChange={mockOnPageChange} />)
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)
    
    expect(mockOnPageChange).toHaveBeenCalledWith(2)
  })

  it('disables previous button on first page', () => {
    render(<Pagination {...defaultProps} currentPage={1} />)
    
    const prevButton = screen.getByRole('button', { name: /previous/i })
    expect(prevButton).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination {...defaultProps} currentPage={10} totalPages={10} />)
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    expect(nextButton).toBeDisabled()
  })

  it('calls onPageSizeChange when page size is changed', () => {
    const mockOnPageSizeChange = vi.fn()
    render(<Pagination {...defaultProps} onPageSizeChange={mockOnPageSizeChange} />)
    
    const pageSizeSelect = screen.getByDisplayValue('20')
    fireEvent.change(pageSizeSelect, { target: { value: '50' } })
    
    expect(mockOnPageSizeChange).toHaveBeenCalledWith(50)
  })

  it('shows loading state when isLoading is true', () => {
    render(<Pagination {...defaultProps} isLoading={true} />)
    
    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('calculates correct item range for different pages', () => {
    render(<Pagination {...defaultProps} currentPage={3} />)
    
    expect(screen.getByText('41')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('handles last page with fewer items correctly', () => {
    render(
      <Pagination 
        {...defaultProps} 
        currentPage={10} 
        totalPages={10} 
        totalItems={195}
        pageSize={20}
      />
    )
    
    expect(screen.getAllByText('195')).toHaveLength(2) // Appears twice in the display
    expect(screen.getByText('181')).toBeInTheDocument()
  })
})