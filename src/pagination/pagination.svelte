<script lang="ts">
    import { currentPage, totalPages } from '../store';
    
    export let changePage: (page: number) => void;
    
    let paginationArray: number[] = [];
    $: {
        const { start, end } = getPaginationRange($currentPage, $totalPages);
        paginationArray = [];
        for (let i = start; i <= end; i++) {
        paginationArray.push(i);
        }
    }
  
    function getPaginationRange(current: number, total: number) {
      const range = 2;
      let start = Math.max(1, current - range);
      let end = Math.min(total, current + range);
  
      const maxPagesToShow = 5;
      const numOfPages = end - start + 1;
      if (numOfPages < maxPagesToShow) {
        if (start > 1) {
          start = Math.max(1, start - (maxPagesToShow - numOfPages));
        }
        if (end < total) {
          end = Math.min(total, end + (maxPagesToShow - numOfPages));
        }
      }
      return { start, end };
    }
</script>
  
<div class="pagination">
{#if $totalPages > 1}
    {#if $currentPage > 1}
    <button class="page-button" on:click={() => changePage($currentPage - 1)}>&laquo;</button>
    {/if}

    {#each paginationArray as page}
    <button 
        class="page-button {page === $currentPage ? 'active' : ''}"
        on:click={() => changePage(Number(page))}
    >
        {page}
    </button>
    {/each}

    {#if $currentPage < $totalPages}
    <button class="page-button" on:click={() => changePage($currentPage + 1)}>&raquo;</button>
    {/if}
{/if}
</div>
