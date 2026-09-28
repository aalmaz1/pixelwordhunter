# -*- coding: utf-8 -*-
"""
rebuild_items_c.py — third pass: repairs for items kept from the original bank.

The first two passes rewrote the items that were not TOEIC material. This pass
comes from a second, independent review of the 391 items that survived (and a
few rewritten ones) and fixes what that review found:

* a *wrong key* — #695 marked "theirs" although only "its" fits the sentence;
* items with **two defensible answers** — #378 ("heard of/about" are both
  correct), #856 ("assist in/with" are both correct), #43 ("three months ago"
  also fits), #714 ("and/but" are both correct);
* a near-duplicate pair — #666 and #706 asked the same "flying would have cost"
  question, #706 is rewritten;
* questions that were off-topic or broken — #388 (Italian politics), #397
  (President Obama), #425 ("is incompetent to govern"), #230 (a 30-word
  definition sentence), #232 ("Each kind of cells"), #250 (a bus driver asleep
  in bed), #270/#276 (school homework), #279 ("apply effort" ambiguity),
  #618 ("Though not a sworn vegetarian … seldom eats meat");
* wording defects — #11 ("home makers", ambiguous "Few"), #129 (missing period
  after "Mr"), #149 ("LTd"), #151 (broken "--" and "100000"),
  #181 ("objurgated"), #206 ("No admission" is also a valid sign),
  #520 (reads "the company's CEO … the company's procedures"),
  #607 ("power-point"), #725 (a statement ending in "?"), #29 ("6.00 PM"),
  #114 (a stray period inside an option), #448 ("about" also fits),
  #57 ("close to" also fits).

Format:  id: (sentence, [four options], correct option)
"""

REPAIRS = {
    11: ("____ of the improvements were suggested by the production team.",
         ["Much", "A little", "Many", "A great deal"], "Many"),
    29: ("The ministers arrived sometime ____ 5:00 and 6:00 p.m.",
         ["from", "at", "after", "between"], "between"),
    43: ("The company began to prepare for the relocation six months ____.",
         ["ago", "since", "before", "past"], "ago"),
    57: ("The minister's French is so good that he sounds almost ____ a native speaker.",
         ["as", "the same", "such as", "like"], "like"),
    114: ("The managers started a new company because they wanted to be ____.",
          ["along", "independent", "freedom", "independence"], "independent"),
    129: ("The Business Development Manager, Mr. Smith, said that he was sure the company ____ have opened a branch in China earlier if it had been able to find suitable human resources.",
          ["would", "will", "shall", "can"], "would"),
    149: ("Global Support Ltd. acted ____ in hiring the best human resources for all its subsidiaries.",
          ["asserts", "assertively", "asserting", "assertion"], "assertively"),
    151: ("The Singing Doll created a great ____ among the customers and sold 100,000 units in the first week after the launch.",
          ["compensation", "determination", "promotion", "sensation"], "sensation"),
    181: ("Their work permits have been ____.",
          ["esteemed", "delayed", "conserved", "revoked"], "revoked"),
    206: ("( in a store ) No ____ before 9 A.M.",
          ["admonition", "addition", "admittance", "admiration"], "admittance"),
    230: ("The company's need for a more humane and flexible schedule is ____ dependent on feedback from staff.",
          ["largely", "possibly", "likely", "terribly"], "largely"),
    232: ("The new machine has several ____ that are described in the manual.",
          ["functions", "duties", "obligations", "positions"], "functions"),
    250: ("The night porter ____ the alarm system twice during his shift.",
          ["tests", "tested", "is testing", "has tested"], "tests"),
    270: ("Employees are asked to ____ the tasks on the weekly checklist.",
          ["accomplish", "relax", "quote", "assign"], "accomplish"),
    276: ("New hires attend weekly tutorials to ____ their skills.",
          ["improve", "challenge", "reflect", "jot down"], "improve"),
    279: ("The team leader will ____ pressure on the supplier to meet the deadline.",
          ["exert", "explain", "determine", "apply"], "exert"),
    378: ("Have you ____ the new Thai restaurant downtown?",
          ["heard for", "heard from", "heard about", "heard with"], "heard about"),
    388: ("Since the new CEO took over, the firm has been one of the most ____ employers in the region.",
          ["stable", "altered", "imported", "certain"], "stable"),
    397: ("____ did the board appoint as the new chief executive?",
          ["Whose", "Who", "Whom", "Who's"], "Whom"),
    425: ("The board considered the candidate ____ to run the company.",
          ["competent", "elaborate", "stern", "polished"], "competent"),
    448: ("I attended a lecture ____ economics at the university.",
          ["on", "in", "for", "at"], "on"),
    520: ("The company's CEO has implemented new ____ procedures for employees in accordance with the law.",
          ["disciplinary", "disciplined", "disciplining", "discipline"], "disciplinary"),
    607: ("Mrs. Summers complained that the CEO's PowerPoint presentation on the history of modern architecture was ____.",
          ["boring", "bored", "boredom", "bores"], "boring"),
    618: ("Not only is Ms. Feld a sworn vegetarian, ____ she also avoids dairy products.",
          ["but", "and", "so", "or"], "but"),
    695: ("Due to ____ high degree of liability, the company must exercise caution in assessing clients' insurance claims.",
          ["their", "it's", "theirs", "its"], "its"),
    706: ("The client asked how much the express delivery would ____.",
          ["cost", "spend", "pay", "charge"], "cost"),
    714: ("Cathy's Coffee has cheap prices, ____ the quality of its drinks is surprisingly high.",
          ["and", "because", "between", "so"], "and"),
    725: ("After much confusion, the Internet service ____ decided to renew our contract.",
          ["provider", "provision", "provide", "provided"], "provider"),
    856: ("The International Financial Institution seeks an outstanding professional to assist ____ a broad range of analytical and advocacy activities.",
          ["at", "for", "of", "with"], "with"),
}
