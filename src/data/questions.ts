/**
 * Questions mode. Everyone gets one question of a pair, the Imposter gets the other, and
 * nobody knows which is which. Both questions in a pair take the same kind of answer (a
 * number, a place, a food…), so the Imposter's answer sounds believable but a little off.
 * Either question can be the group's; the game picks the side at random.
 */
export type QuestionKind = 'number' | 'place' | 'food' | 'person' | 'thing' | 'media' | 'activity';

export interface QuestionPair {
  a: string;
  b: string;
  kind: QuestionKind;
}

const pair = (kind: QuestionKind, a: string, b: string): QuestionPair => ({ a, b, kind });

export const QUESTION_PAIRS: readonly QuestionPair[] = [
  // Numbers
  pair('number', 'How many hours do you sleep on a normal night?', 'How many hours a day do you spend on your phone?'),
  pair(
    'number',
    'How many cups of tea or coffee do you drink in a day?',
    'How many glasses of water do you drink in a day?',
  ),
  pair(
    'number',
    'How old were you when you got your first phone?',
    'How old were you when you learned to ride a cycle?',
  ),
  pair('number', 'How many close friends do you have?', 'How many cousins do you have?'),
  pair('number', 'How many times a week do you eat outside?', 'How many times a week do you exercise?'),
  pair('number', 'How many idlis can you eat in one go?', 'How many chapatis can you eat in one go?'),
  pair('number', 'How many apps are on your home screen?', 'How many WhatsApp groups are you in?'),
  pair('number', 'How many movies do you watch in a theatre in a year?', 'How many trips do you take in a year?'),
  pair('number', 'How much would you pay for a movie ticket?', 'How much would you pay for a plate of biryani?'),
  pair(
    'number',
    'How many minutes do you take to get ready in the morning?',
    'How many minutes do you take to fall asleep?',
  ),
  pair('number', 'How many phones have you had so far?', 'How many houses have you lived in so far?'),
  pair('number', 'How many people were in your class at school?', 'How many people came to your last birthday party?'),
  pair('number', 'How many languages can you speak?', 'How many states of India have you visited?'),
  pair('number', 'At what age should people get married?', 'At what age should people start their first job?'),
  pair('number', 'How many days of holiday do you take in a year?', 'How many days a year do you fall sick?'),
  pair(
    'number',
    'Roughly how many photos are in your phone gallery?',
    'Roughly how many contacts are saved in your phone?',
  ),
  pair('number', 'How many push-ups can you do?', 'How many floors can you climb without getting tired?'),
  pair('number', 'How many times an hour do you check your phone?', 'How many times a day do you open Instagram?'),
  pair('number', 'What is the most you have spent on a pair of shoes?', 'What is the most you have spent on a gift?'),
  pair(
    'number',
    'How many kilometres would you travel for really good food?',
    "How many kilometres would you travel for a friend's wedding?",
  ),
  pair('number', 'How many hours can you go without your phone?', 'How many hours can you go without eating?'),
  pair('number', 'How many alarms do you set in the morning?', 'How many times do you press snooze?'),
  pair('number', 'How many pairs of shoes do you own?', 'How many watches or bags do you own?'),
  pair(
    'number',
    'How many cups of filter coffee is too many in a day?',
    'How many samosas is too many in one sitting?',
  ),

  // Places
  pair('place', 'Where would you go for a honeymoon?', 'Where would you go on a college trip?'),
  pair('place', 'Where do you go to relax?', 'Where do you go to study or work quietly?'),
  pair('place', 'Which city would you like to live in?', 'Which city would you like to visit just once?'),
  pair('place', 'Where would you take someone on a first date?', 'Where would you take your parents on a weekend?'),
  pair('place', 'Where would you go on holiday in summer?', 'Where would you go on holiday in winter?'),
  pair('place', 'Where would you go for a weekend trip?', 'Where would you go for a two-week holiday?'),
  pair('place', 'Which country would you most like to visit?', "Which country's food would you most like to try?"),
  pair('place', 'Where do you usually hang out with friends?', 'Where do you go when you are bored?'),
  pair(
    'place',
    'Which place in your city do you love most?',
    'Which place in your city would you show a visitor first?',
  ),
  pair('place', 'Where do you go when you need to think?', "Where would you hide if you didn't want to be found?"),
  pair('place', 'Where would you like to celebrate your birthday?', 'Where would you hold a school reunion?'),
  pair('place', 'Which state of India would you like to explore?', 'Which state of India has the best food?'),
  pair('place', 'Where do you usually go shopping?', 'Where do you go to buy a gift?'),
  pair('place', 'Where would you go on a solo trip?', 'Where would you go on a trip with your whole family?'),
  pair('place', 'Which beach would you like to visit?', 'Which hill station would you like to visit?'),
  pair('place', 'Where would you live if you won the lottery?', 'Where would you live after you retire?'),

  // Food
  pair('food', 'What is your favourite breakfast?', 'What would you eat at 2 am?'),
  pair('food', 'What is the best street food?', 'What is the best food at a wedding?'),
  pair('food', 'What do you order at a tea shop?', 'What snack do you buy on a train journey?'),
  pair('food', 'What is your comfort food?', 'What do you eat when you are sick?'),
  pair('food', 'What dish can you cook well?', 'What dish do you always order at a restaurant?'),
  pair('food', 'Which sweet do you like most?', 'Which sweet do you look forward to at Diwali?'),
  pair('food', 'What do you eat at the movies?', 'What do you eat while watching a match at home?'),
  pair('food', 'Which fruit do you like most?', 'Which fruit do you buy most often?'),
  pair('food', 'What would be your last meal?', 'What would you cook to impress someone?'),
  pair('food', 'What do you usually have for lunch?', 'What do you usually have for dinner?'),
  pair('food', 'Which ice cream flavour do you pick?', 'Which cake flavour do you pick for a birthday?'),
  pair('food', 'What is the best food on a rainy day?', 'What is the best food on a hot day?'),
  pair('food', 'What do you always order on Swiggy or Zomato?', 'What do you always buy at the supermarket?'),
  pair('food', 'Which food did you hate as a kid?', 'Which food can you never stop eating?'),
  pair('food', 'What is the best thing to eat at a beach?', 'What is the best thing to eat on a road trip?'),
  pair('food', 'What is your favourite chutney?', 'What is your favourite pickle?'),

  // People
  pair('person', 'Which actor would play you in a movie?', 'Which actor would you like as your neighbour?'),
  pair('person', 'Who is the funniest person you know?', 'Who would you call in an emergency?'),
  pair(
    'person',
    'Which celebrity would you like to have dinner with?',
    'Which celebrity would you never trust with a secret?',
  ),
  pair('person', 'Which cricketer would you want in your team?', 'Which cricketer do you think is overrated?'),
  pair('person', 'Who in this room would survive a zombie attack?', 'Who in this room is always late?'),
  pair('person', 'Who in this room would make a good teacher?', 'Who in this room would make a good politician?'),
  pair('person', 'Which singer do you listen to most?', 'Which singer would you like to see live?'),
  pair('person', 'Which movie character are you most like?', 'Which movie character would you like to date?'),
  pair('person', "Which music director's songs do you love most?", "Which music director's songs make you dance?"),
  pair('person', 'Which comedian makes you laugh the most?', 'Which actor would you like to act with?'),
  pair('person', 'Who in this room spends the most money?', 'Who in this room would win a cooking contest?'),
  pair('person', "Which hero's mass scenes give you goosebumps?", "Which hero's dance steps can you copy?"),
  pair(
    'person',
    'Who in this room would be a great travel buddy?',
    'Who in this room would you call to fix your phone?',
  ),
  pair(
    'person',
    'Which famous person would you swap lives with for a day?',
    'Which famous person would you ask for advice?',
  ),

  // Things
  pair('thing', 'What is the first thing you do in the morning?', 'What is the last thing you do at night?'),
  pair('thing', 'What would you take to a deserted island?', 'What would you pack for a weekend trip?'),
  pair('thing', 'What would you buy first if you won the lottery?', 'What would you buy if you got a big bonus?'),
  pair('thing', 'What is your favourite colour?', 'What colour is your favourite shirt?'),
  pair('thing', 'Which app do you open the most?', 'Which app would you delete first?'),
  pair('thing', 'What is always in your bag?', 'What do you always forget to carry?'),
  pair('thing', 'What gift would you love to get?', 'What gift would you give your best friend?'),
  pair('thing', 'What is the best birthday gift you ever got?', 'What is the strangest gift you ever got?'),
  pair('thing', 'Which vehicle would you like to own?', 'Which vehicle did you first learn to drive?'),
  pair('thing', 'What would you save first in a fire?', 'What would you never lend to anyone?'),
  pair('thing', 'What is your phone wallpaper?', 'What is your WhatsApp profile picture?'),
  pair('thing', "What is something you can't throw away?", 'What is something you keep buying again?'),
  pair('thing', 'What would you change about your house?', 'What would you change about your phone?'),
  pair('thing', 'What is the most useful thing you own?', 'What is the most expensive thing you own?'),

  // Movies, music and shows
  pair('media', 'Which movie can you watch again and again?', 'Which movie made you cry?'),
  pair('media', 'Which song is always stuck in your head?', 'Which song would you play at a party?'),
  pair('media', 'Which web series did you binge in one go?', 'Which web series would you recommend to your parents?'),
  pair(
    'media',
    'Which Tamil movie is your all-time favourite?',
    'Which Tamil movie did you watch in a theatre more than once?',
  ),
  pair('media', 'Which old song do you still love?', 'Which song reminds you of your school days?'),
  pair('media', 'Which cartoon did you watch as a kid?', 'Which cartoon would you still watch today?'),
  pair(
    'media',
    'Which movie would you show a friend from another country?',
    'Which movie would you watch on a long flight?',
  ),
  pair('media', 'Which movie scared you the most?', 'Which movie confused you the most?'),
  pair('media', 'Which TV show did your family watch together?', 'Which TV show do you watch alone?'),
  pair('media', 'Which game did you play most as a kid?', 'Which game would you play at a family function?'),
  pair('media', 'Which YouTube channel do you watch the most?', 'Which Instagram page do you follow for memes?'),
  pair('media', 'Which movie dialogue do you use in real life?', 'Which movie dialogue do you find cringe?'),
  pair('media', 'Which IPL team do you support?', 'Which IPL team do you love to see lose?'),
  pair('media', 'Which movie would you like a sequel of?', 'Which movie would you remake?'),

  // Habits, plans and preferences
  pair('activity', 'What time do you wake up on a weekday?', 'What time do you wake up on a Sunday?'),
  pair('activity', 'What time do you usually go to bed?', 'What time do you usually have dinner?'),
  pair('activity', 'What is your favourite thing to do on a holiday?', "What do you do when you can't sleep?"),
  pair('activity', 'Which hobby would you like to learn?', 'Which hobby did you give up?'),
  pair('activity', 'Which festival do you enjoy the most?', 'Which festival has the best food?'),
  pair('activity', 'Which month do you like the most?', 'Which month is the busiest for you?'),
  pair('activity', 'Which sport do you like to watch?', 'Which sport have you actually played?'),
  pair('activity', 'Which school subject were you best at?', 'Which school subject did you hate the most?'),
  pair('activity', "What job would you do if money didn't matter?", 'What job would you never do?'),
  pair('activity', 'What do you do when you are angry?', 'What do you do when you are bored?'),
  pair('activity', 'What would you do on your last day on earth?', 'What would you do on a day with no phone?'),
  pair('activity', 'What is your usual excuse for being late?', 'What is your usual excuse for not picking up a call?'),
  pair('activity', 'Which animal would you like as a pet?', 'Which animal are you scared of?'),
  pair('activity', 'What do you do during a power cut?', 'What do you do on a long train journey?'),
  pair(
    'activity',
    'What do you do first when you reach home?',
    'What do you do first when you reach the office or college?',
  ),
  pair(
    'activity',
    'What would you do with a free afternoon?',
    'What would you do if your flight was delayed by five hours?',
  ),
];
