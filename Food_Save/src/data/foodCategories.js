/**
 * Food category data for the Food Category Search page (/food).
 * Order matches design-reference/08-food-list.png exactly:
 *   Row 1: Fast Food | Breakfast & Brunch
 *   Row 2: Mexican | Bakery
 *   Row 3: Deserts | Burgers
 *   Row 4: Indian | Pizza
 *
 * "Deserts" spelling is intentional per the design specification.
 * All images are local assets from src/assets/images/.
 */
import fastFoodImage from '../assets/images/fastfood.jpg'
import breakfastBrunchImage from '../assets/images/breakfastbrunch.jpg'
import mexicanImage from '../assets/images/mexican.jpg'
import bakeryImage from '../assets/images/bakery.jpg'
import desertsImage from '../assets/images/deserts.jpg'
import burgersImage from '../assets/images/burgers.jpg'
import indianImage from '../assets/images/indian.jpg'
import pizzaImage from '../assets/images/pizza.jpg'

export const foodCategories = [
  { id: 'fast-food', name: 'Fast Food', image: fastFoodImage },
  { id: 'breakfast-brunch', name: 'Breakfast & Brunch', image: breakfastBrunchImage },
  { id: 'mexican', name: 'Mexican', image: mexicanImage },
  { id: 'bakery', name: 'Bakery', image: bakeryImage },
  { id: 'deserts', name: 'Deserts', image: desertsImage },
  { id: 'burgers', name: 'Burgers', image: burgersImage },
  { id: 'indian', name: 'Indian', image: indianImage },
  { id: 'pizza', name: 'Pizza', image: pizzaImage },
]