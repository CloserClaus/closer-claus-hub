import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
} from 'lucide-react';

interface PaginationInfo {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

interface ResultsPaginationProps {
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
}

export function ResultsPagination({
  pagination,
  onPageChange,
  onPerPageChange,
}: ResultsPaginationProps) {
  const { page, per_page, total_entries, total_pages } = pagination;
  
  const startEntry = (page - 1) * per_page + 1;
  const endEntry = Math.min(page * per_page, total_entries);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const showPages = 5; // Max pages to show
    
    if (total_pages <= showPages + 2) {
      // Show all pages if total is small
      for (let i = 1; i <= total_pages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (page > 3) {
        pages.push('ellipsis');
      }
      
      // Show pages around current
      const start = Math.max(2, page - 1);
      const end = Math.min(total_pages - 1, page + 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (page < total_pages - 2) {
        pages.push('ellipsis');
      }
      
      // Always show last page
      if (total_pages > 1) {
        pages.push(total_pages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{startEntry.toLocaleString()}</span> to{' '}
        <span className="font-medium">{endEntry.toLocaleString()}</span> of{' '}
        <span className="font-medium">{total_entries.toLocaleString()}</span> results
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Per page selector */}
        {onPerPageChange && (
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={per_page.toString()}
              onValueChange={(value) => onPerPageChange(parseInt(value))}
            >
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* First page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((pageNum, idx) => (
            pageNum === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                ...
              </span>
            ) : (
              <Button
                key={pageNum}
                variant={pageNum === page ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8"
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </Button>
            )
          ))}
        </div>

        {/* Mobile page indicator */}
        <div className="sm:hidden px-2 text-sm">
          Page {page} of {total_pages}
        </div>

        {/* Next page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= total_pages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(total_pages)}
          disabled={page >= total_pages}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
