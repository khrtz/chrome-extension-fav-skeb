import { writable } from 'svelte/store';

export const favorites = writable<Favorite[]>([]);
export const filteredFavorites = writable<Favorite[]>([]);
export const currentPage = writable(1);
export const totalPages = writable(1);