import { writable } from 'svelte/store';

export const currentPage = writable(1);
export const favorites = writable<Favorite[]>([]);
export const filteredFavorites = writable<Favorite[]>([]);
