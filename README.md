# GlidePath

To use:

  1. Clone source
  2. Launch index.html
  3. Toggle "Show Trails"


The objects start out in random locations. The only force on them is 
gravity - each object applies gravity to each other object based on 
the well-known gravity equation:

   Force = (G * mass1 * mass2) / (distance ^ 2)

 All objects have the same mass so it reduces to:

   F = G / d^2


Because of the d in the denominator, the gravity gets bigger as the objects
get close - the d^2 makes it non-linear which is why the objects speed up
so much as they get close.


Author:
  Ted Barram
  tbarram@yahoo.com

