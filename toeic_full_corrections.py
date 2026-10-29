"""Evidence-based, source-guarded corrections to the generated full-test bank.

Raw exam files are deliberately unchanged. Keys are (source filename, part,
original question number), not shuffled display order. Every rule verifies the
old key, affected options and supporting text before changing the output.
"""

QUESTION_REVISIONS = {}


def revision(test, part, number, old_answer, *, stem=None, replace=None,
             correct=None, accepted=None, options=None, evidence=(), en=None, ko=None):
    key = (test, part, number)
    if key in QUESTION_REVISIONS:
        raise ValueError(f'Duplicate full-test revision: {key}')
    QUESTION_REVISIONS[key] = {
        'old_answer': old_answer, 'stem': stem, 'replace': replace or {},
        'correct': correct, 'accepted': accepted, 'options': options,
        'evidence': evidence, 'en': en, 'ko': ko,
    }


H = 'hacker_new_toeic_test_02'
A10 = 'actual_test_2026_10'
A11 = 'actual_test_2026_11'
A12 = 'actual_test_2026_12'
N02 = 'new_economy_2018_test_02'
N04 = 'new_economy_2018_test_04'
N05 = 'new_economy_2018_test_05'
N08 = 'new_economy_2018_test_08'
N09 = 'new_economy_2018_test_09'
N10 = 'new_economy_2018_test_10'
N20 = 'new_economy_2018_test_20'
N21 = 'new_economy_2018_test_21'

# Listening: corrected source keys, overstatements, missing qualifiers, and
# choices that are both reasonable responses to the same question.
revision(H, 2, 28, "Let's relax here a bit longer.",
         accepted=["Let's relax here a bit longer.", "OK, if you're done swimming."],
         en='Either staying a little longer or agreeing to return if the other person is done swimming is a reasonable reply.',
         ko='조금 더 머물자는 답과 상대가 수영을 마쳤다면 돌아가자는 답 모두 자연스럽습니다.')
revision(N21, 2, 17, "Of course. I'd love to.", correct='Sometime next month, I think.',
         en='The question concerns Mary having a baby; the response gives an expected time. The original key is a reply to an invitation.',
         ko='메리가 출산할 예정인지 묻는 말에 다음 달쯤이라는 시기를 답합니다. 원래 정답은 초대에 대한 응답입니다.')
revision(N09, 2, 29, 'yes, and I changed the tired on it.',
         replace={'yes, and I changed the tired on it.': 'Yes, and I changed the tires on it.'},
         en='The seller confirms the vehicle is for sale and mentions changing its tires.',
         ko='판매자는 차량을 판매한다고 확인하고 타이어를 교체했다고 말합니다.')
revision(N10, 2, 11, 'It broke this morning.',
         stem=("Why isn't the leader on?", "Why isn't the light on?"),
         en='The answer explains that the light broke this morning. The source translations identify the object as a light.',
         ko='불이 켜지지 않는 이유는 오늘 아침에 고장 났기 때문입니다.')
revision(N02, 3, 67, 'Call her manager',
         stem=('What does the man suggest the woman to do?', 'What does the man suggest that the woman do?'),
         replace={'Call her manager': 'Talk to the manager'}, evidence=('talk to the manager',),
         en='He suggests talking to the manager about changing the schedule; he does not specify a phone call.',
         ko='남자는 일정 변경에 관해 관리자와 이야기하라고 제안합니다. 전화하라는 말은 없습니다.')
revision(N02, 4, 90, 'He is asking if Julia is familiar with the requirements.',
         stem=('What does the man imply when he asks: "Have you seen the criteria for the dental assistant position"?',
               'What does the man ask the listener about?'),
         replace={'He is asking if Julia is familiar with the requirements.': 'Whether she has seen the job requirements.'},
         evidence=('Have you seen the criteria',),
         en='He asks whether the listener has seen the criteria. The recording never identifies her as Julia.',
         ko='남자는 상대방이 채용 기준을 보았는지 묻습니다. 녹음에는 상대방의 이름이 줄리아라고 나오지 않습니다.')
revision(N02, 4, 91, 'To teach him the criteria',
         replace={'To teach him the criteria': 'So she can explain the criteria to him'},
         evidence=('teach me the criteria',),
         en='He asks the listener to come to his office and explain the criteria.',
         ko='그는 상대방에게 사무실로 와서 채용 기준을 설명해 달라고 부탁합니다.')
revision(N02, 4, 97, 'Get married to his girlfriend',
         stem=('What will the guest most likely do next?', 'What upcoming event in the guest’s life is mentioned?'),
         evidence=('up and coming marriage',),
         en='The host mentions the guest’s upcoming marriage; the recording does not establish the next event in his life.',
         ko='진행자는 게스트의 예정된 결혼을 언급하지만, 인생에서 다음으로 일어날 일이 무엇인지는 확정하지 않습니다.')
revision(N04, 3, 63, 'Barrel nuts',
         stem=('Look at the graphic. What is the women missing?', 'Look at the graphic. Which items is the woman missing?'),
         accepted=['Barrel nuts', 'Allen key'], evidence=('tool to put in the bolts', '3 barrel nuts'),
         en='She is missing three barrel nuts and the tool for inserting bolts; the graphic identifies the tool as the Allen key. Both answers are supported.',
         ko='여자는 배럴 너트 세 개와 볼트를 끼우는 도구가 없다고 합니다. 그림에서 그 도구는 육각 렌치이므로 두 답 모두 맞습니다.')
revision(N04, 4, 99, '9 AM to 5 PM',
         stem=('Look at the graphic. What are the hours of the lap pool?',
               'Look at the sign-up sheet. What range of times is shown?'),
         en='The sheet shows columns from 9 A.M. through 5 P.M. It does not establish the pool’s opening or closing hours.',
         ko='신청서에는 오전 9시부터 오후 5시까지의 시간대가 표시되어 있습니다. 실제 수영장 운영 시간은 확인할 수 없습니다.')
revision(N05, 3, 52, 'Call some co- workers',
         replace={'Call some co- workers': 'Inform everyone about the cancellation'},
         evidence=("I'll inform everyone for you",),
         en='She offers to inform everyone; the dialogue does not say she will call them.',
         ko='여자는 모두에게 알려 주겠다고 제안하지만, 전화로 알리겠다고 하지는 않습니다.')
revision(N05, 3, 57, 'The flowers look fake',
         stem=('What does the woman imply when she says "Are they real?"',
               'What does the woman want to know when she asks "Are they real?"'),
         replace={'The flowers look fake': 'Whether the flowers are real'}, evidence=('Are they real?',),
         en='She asks whether the flowers are real. The dialogue does not establish why she asks.',
         ko='여자는 꽃이 진짜인지 묻습니다. 왜 그렇게 묻는지는 대화에서 밝혀지지 않습니다.')
revision(N05, 3, 66, 'Carbon paper',
         stem=('Look at the graphic. What will the man NOT order for the woman?',
               'Look at the graphic. Which item is unrelated to the supply needs discussed?'),
         evidence=('wrap a lot of gifts', 'business cards'),
         en='The speakers discuss gift wrapping, a headset and business cards, but not carbon paper. They do not explicitly order the wrapping paper.',
         ko='대화에서는 선물 포장, 헤드셋, 명함을 언급하지만 카본지는 언급하지 않습니다. 포장지를 주문한다는 말도 명시되어 있지 않습니다.')
revision(N05, 4, 87, "Members of the center shouldn't come.",
         correct='Members of the center should come in the afternoon.', evidence=('hold off until later', '12:00 P.M.'),
         en='Hot water will be off until noon, so he suggests postponing exercise until later, not avoiding the center altogether.',
         ko='정오까지 온수가 나오지 않으므로 운동을 그 이후로 미루라는 뜻이지, 센터에 아예 오지 말라는 뜻은 아닙니다.')
revision(N09, 3, 66, 'Milk',
         stem=('Look at the graphic. Which ingredient is the man worried about?',
               'Look at the graphic. Which ingredient must the man avoid because he is lactose intolerant?'),
         evidence=("I'm lactose intolerant",),
         en='He wants few carbohydrates, but says he is lactose intolerant when offered a milk-based drink.',
         ko='남자는 탄수화물이 적은 제품을 원하며, 우유가 들어간 음료에 대해서는 유당 불내증이 있다고 말합니다.')
revision(N09, 3, 70, 'Clean the carpets',
         stem=('What are the speakers probably going to do next?', 'What do the speakers need to do after finishing the windows?'),
         evidence=('finished with the windows', 'start on the carpets'),
         en='They will begin the carpets after finishing the windows; the dialogue also mentions other work beforehand.',
         ko='두 사람은 창문 청소를 마친 뒤 카펫 청소를 시작할 예정입니다. 그 전에 해야 할 일도 언급됩니다.')
revision(N09, 4, 81, 'Educational programs',
         replace={'Educational programs': 'After-school activities'}, evidence=('all after-school activities',),
         en='The weather announcement cancels after-school activities, not educational programs generally.',
         ko='기상 안내는 방과 후 활동을 취소한다고 말하며, 모든 교육 프로그램을 취소한다고 하지는 않습니다.')
revision(N09, 4, 87, "Don't come during the day.",
         replace={"Don't come during the day.": 'Come in the evening instead of at breakfast time.'},
         evidence=('not be having a breakfast service', 'come in the evening'),
         en='Breakfast service is suspended during renovations, and the speaker suggests an evening visit. He does not forbid all daytime visits.',
         ko='공사 중에는 아침 식사 서비스가 중단되어 저녁 방문을 제안합니다. 낮 시간 전체에 오지 말라는 뜻은 아닙니다.')
revision(N10, 3, 70, 'Express-post it to her',
         accepted=['Express-post it to her', 'Deliver it to her'], evidence=("express-post one to you",),
         en='Express-posting the missing tool is also a way of delivering it to her, so both options describe his offer.',
         ko='빠른 우편으로 공구를 보내는 것도 여자에게 배송하는 방법이므로 두 답 모두 남자의 제안을 설명합니다.')
revision(N20, 3, 67, 'Take the subway', correct='Take a bus', evidence=('suggest you take the bus',),
         en='The woman explicitly suggests taking the bus tomorrow.',
         ko='여자는 내일 버스를 타라고 명시적으로 제안합니다.')
revision(N20, 4, 81, 'Write down an agenda',
         replace={'Write down an agenda': 'Take notes on the meeting'}, evidence=('note taker', 'keep track of what is debated'),
         en='The volunteer will take notes on the discussion and send a summary; writing the agenda is not mentioned.',
         ko='자원자는 논의 내용을 기록하고 요약을 보냅니다. 회의 안건을 작성한다는 말은 없습니다.')
revision(N20, 4, 99, 'Pies',
         stem=("Look at the letter. What do you think Millie's Diner prides itself on?",
               "Look at the letter. What does the sign say Millie's Diner is the home of?"),
         en='The sign in the letter identifies the diner as the home of pies. The speech also praises customer service, so the original question was ambiguous.',
         ko='편지 속 간판은 식당을 파이의 본고장이라고 소개합니다. 연설은 고객 서비스도 칭찬하므로 원래 질문에는 답이 둘일 수 있습니다.')
revision(N21, 3, 55, 'She will cancel her meetings.',
         replace={'She will cancel her meetings.': 'She will cancel her last meeting.'}, evidence=('cancel my last meeting',),
         en='She says she will cancel her last meeting, not all of her meetings.',
         ko='여자는 마지막 회의 하나를 취소한다고 말하며, 모든 회의를 취소한다고 하지는 않습니다.')
revision(N21, 3, 62, 'Technicians in the building next door',
         replace={'Technicians in the building next door': 'Inspectors in the building next door'},
         evidence=('inspectors in the building next door',),
         en='Harriet saw inspectors in the neighboring building. The technicians are mentioned separately.',
         ko='해리엇은 옆 건물에서 점검원들을 보았습니다. 기술자들은 별도로 언급됩니다.')
revision(N21, 4, 99, 'Constellation guide',
         stem=('Who is Star master Jenkins?', 'Besides hosting, what role will Star master Jenkins perform?'),
         evidence=('our host, Star master Jenkins', 'directing you through the constellations'),
         en='Jenkins is the host and will also guide passengers through the constellations. The revised question asks for the second role.',
         ko='젠킨스는 진행자이면서 승객에게 별자리를 안내합니다. 수정된 질문은 두 번째 역할을 묻습니다.')

# Reading grammar and insertion questions. Multiple answers are retained only
# where the surrounding text does not distinguish the alternatives.
revision(A11, 6, 133, 'Approved amounts will be added to the next scheduled paycheck.',
         accepted=['Approved amounts will be added to the next scheduled paycheck.',
                   'Receipts should be kept for your personal records.'],
         evidence=('photograph each receipt', 'Claims', 'receipts will be returned'),
         en='The paragraph explains how to submit receipts. Both keeping receipts for your records and receiving approved amounts on a paycheck are coherent next steps.',
         ko='이 단락은 영수증을 제출하는 절차를 설명합니다. 영수증을 보관하라는 안내와 승인 금액이 급여에 포함된다는 안내 모두 자연스럽게 이어집니다.')
revision(N02, 5, 118, 'Provided that', accepted=['Provided that', 'Seeing that'],
         evidence=('the building has an excellent location',),
         en='“Provided that” makes the features a condition, while “seeing that” gives them as a reason. Both are grammatical and plausible without more context.',
         ko='“Provided that”은 조건을, “seeing that”은 이유를 나타냅니다. 추가 맥락이 없으면 두 표현 모두 문법과 의미상 가능합니다.')
revision(N02, 5, 127, 'rising',
         stem=('Because of ------ fuel costs, some people are choosing to stay home for the summer vacation rather than drive tourist sites.',
               'Because of ------ fuel costs, some people are choosing to stay home for the summer vacation rather than drive to tourist sites.'),
         en='“Rising” describes increasing fuel costs. The missing “to” in “drive to tourist sites” has been restored.',
         ko='“Rising”은 상승하는 연료비를 수식합니다. “drive to tourist sites”에 빠진 전치사도 복원했습니다.')
revision(N04, 5, 129, 'those',
         en='“Those” determines the plural noun “delegates.” “Wearing their ID badges” is a reduced relative clause meaning “who are wearing their ID badges.”',
         ko='“Those”는 복수 명사 “delegates”를 한정합니다. “wearing their ID badges”는 “who are wearing their ID badges”를 줄인 관계절입니다.')
revision(N10, 5, 101, 'Because',
         en='“Because” introduces a reason. The sentence says the difference between the brands is small, but does not say that the difference is in price.',
         ko='“Because”는 이유를 이끕니다. 문장에는 두 브랜드의 차이가 작다고만 되어 있고 그 차이가 가격이라고 명시되어 있지 않습니다.')
revision(N04, 6, 137, 'And if symptoms persist for more than ten days, consult a physician.',
         accepted=['And if symptoms persist for more than ten days, consult a physician.',
                   'The medication may cause serious side effects if not taken properly.'],
         evidence=('Keep out of the reach of children',),
         en='Both sentences add a relevant medication safety warning after the other warnings. The surrounding text does not uniquely rule either one out.',
         ko='두 문장 모두 다른 주의사항 뒤에 이어질 수 있는 약물 안전 경고입니다. 주변 문장만으로 둘 중 하나를 배제할 수 없습니다.')
revision(N04, 6, 140, 'estimate', accepted=['estimate', 'calculate'],
         evidence=('amount of time it will take', 'approximate costs'),
         en='A professional can estimate the time and approximate costs or calculate those figures. Both verbs fit the sentence.',
         ko='전문가는 소요 시간과 대략적인 비용을 추정하거나 계산할 수 있으므로 두 동사 모두 문맥에 맞습니다.')
revision(N04, 6, 142, 'Please call us at 555-1245 if you are interested in a consultation.',
         accepted=['Please call us at 555-1245 if you are interested in a consultation.',
                   'We welcome any business opportunity with you.',
                   "Please don't hesitate to email any questions you have.",
                   'Visit our website for more information.'],
         en='All four sentences are coherent ways to conclude this reply. The source gives no evidence that selects only one, so the question is not scored.',
         ko='네 문장 모두 이 답장의 마무리로 자연스럽습니다. 원문만으로 하나를 고를 근거가 없어 이 문제는 점수에 반영되지 않습니다.')
revision(N05, 6, 136, 'over', accepted=['over', 'around'],
         evidence=('20 years',),
         en='Both “for over 20 years” and “for around 20 years” are natural; no exact duration is provided to choose between them.',
         ko='“20년 이상”과 “약 20년” 모두 자연스럽습니다. 정확한 기간이 제시되지 않아 하나를 고를 수 없습니다.')
revision(N08, 6, 137, 'During this time, your temporary workspace will be the first-floor conference room.',
         accepted=['During this time, your temporary workspace will be the first-floor conference room.',
                   'If it takes longer, we will notify you.'],
         evidence=('renovations will take approximately 5 days',),
         en='Both the temporary workspace and a notice about possible delays relate directly to the five-day renovation and fit here.',
         ko='임시 업무 공간 안내와 공사 지연 시 알림 약속은 모두 5일가량의 공사에 직접 관련되어 이 자리에 자연스럽게 이어집니다.')
revision(N09, 6, 140, 'would be', correct='must be',
         evidence=('Each application', 'received before the applicable deadline'),
         en='The letter gives mandatory submission instructions: each application must be enclosed in its own envelope and received before the deadline. “Would be” has no stated condition.',
         ko='이 편지는 필수 제출 지침을 안내합니다. 신청서는 각각 봉투에 넣어 마감 전에 도착해야 하므로 “must be”가 맞습니다. “would be”에 필요한 조건은 제시되지 않습니다.')

# Part 7: limit each answer to what the passage actually states or supports.
revision(A10, 7, 188, 'He will not receive passes to the networking dinner.',
         replace={'He will not receive passes to the networking dinner.': 'He does not qualify for the early-registration free passes.'},
         evidence=('August 31', 'September 3'),
         en='The free passes are for registrations by August 31; his form was submitted September 3. The text does not rule out obtaining passes another way.',
         ko='무료 입장권은 8월 31일까지 등록한 업체에 제공되지만 신청서는 9월 3일에 제출되었습니다. 다른 방법으로 입장권을 얻을 수 없다는 뜻은 아닙니다.')
revision(A11, 7, 167, 'It will be tested on a later date at an extra cost.',
         replace={'It will be tested on a later date at an extra cost.': 'It will remain locked until a second inspection can be arranged.'},
         evidence=('locked until a second inspection can be arranged',),
         en='An uncleared hood cannot be certified and will remain locked until a second inspection can be arranged at the department’s expense.',
         ko='정리되지 않은 후드는 인증할 수 없으며, 부서 비용으로 재점검을 마련할 수 있을 때까지 잠깁니다.')
revision(A12, 7, 198, 'Her products are not prepared food.',
         replace={'Her products are not prepared food.': 'Her products are sold in sealed jars.'},
         evidence=('products are sold in sealed jars',),
         en='The coordinator says the sealed jars are the reason the permit is not required. The text does not say that jams and pickles are not prepared foods.',
         ko='담당자는 제품이 밀봉된 병에 담겨 판매되기 때문에 허가증이 필요 없다고 설명합니다. 잼과 피클이 조리 식품이 아니라고 하지는 않습니다.')
revision(H, 7, 162, 'An advertising',
         replace={'An advertising': 'An advertising agency', 'A television': 'A television station'},
         evidence=('promotion project',),
         en='The team is working on a commercial and an online campaign for an automobile client, suggesting an advertising agency.',
         ko='팀이 자동차 고객의 광고와 온라인 캠페인을 제작하므로 광고 대행사에서 일할 가능성이 높습니다.')
revision(H, 7, 180, 'She paid a yearly charge to Maxfield Financial Group.',
         replace={'She paid a yearly charge to Maxfield Financial Group.': 'She is receiving both a paper copy and an electronic statement.'},
         evidence=('first electronic statemment', 'your copy will arrive via mail'),
         en='The email includes her first electronic statement and says a copy will arrive by mail. It does not identify the payment mentioned as the annual paper-statement fee.',
         ko='이메일에는 첫 전자 명세서가 첨부되어 있고 종이 사본도 우편으로 도착할 예정입니다. 언급된 결제가 종이 명세서 연회비인지는 알 수 없습니다.')
revision(H, 7, 191, 'It did not take pictures for aa booklet.',
         replace={'It did not take pictures for aa booklet.': 'It lists photography for the annual report, but not for the booklet.'},
         evidence=('Photography of Annual Shareholders Report', 'Design and Layout of Terms and Conditions Booklet'),
         en='Photography is listed on the invoice for the annual report; the booklet line lists only design and layout. That does not prove who took any booklet photos.',
         ko='청구서에는 연례 보고서의 사진 작업이 명시되어 있지만 소책자에는 디자인과 편집만 기재되어 있습니다. 소책자 사진을 누가 찍었는지는 알 수 없습니다.')
revision(H, 7, 195, 'It distributed brochures to potential US clients.',
         replace={'It distributed brochures to potential US clients.': 'It launched a marketing campaign in the United States.'},
         evidence=("last month's launch of our marketing campaign in the United States",),
         en='The newsletter mentions a US campaign launch attended by potential clients. It does not say brochures were distributed there.',
         ko='뉴스레터는 잠재 고객들이 참석한 미국 마케팅 캠페인 출시 행사를 언급합니다. 그곳에서 소책자를 배포했다고 하지는 않습니다.')
revision(H, 7, 197, 'Some of its members can take a class in wedding photography.',
         replace={'Some of its members can take a class in wedding photography.': 'Four members want a beginner-level landscape photography class.'},
         evidence=('Four of us want to take landscape photography',),
         en='The club president says four members want beginner landscape photography. The schedule does not state whether wedding photography is an advanced class.',
         ko='동호회 회장은 회원 네 명이 초급 풍경 사진 수업을 원한다고 말합니다. 웨딩 사진 수업의 수준은 일정에 명시되지 않았습니다.')
revision(N02, 7, 157, 'It’s one of the most profitable collaborations for the company.',
         replace={'It’s one of the most profitable collaborations for the company.': 'It is the company’s most successful collaboration so far.'},
         evidence=('most successful to date',),
         en='The article calls the collaboration the most successful to date; it gives no profit figures.',
         ko='기사는 이 협업을 지금까지 가장 성공적이라고 표현하지만 수익 수치는 제시하지 않습니다.')
revision(N02, 7, 158, '[3]',
         stem=('In which of the positions marked [1], [2], [3], and [4] does the following sentence belong? "There is a first for the company since all previous limited designer edition lines were simply a one-time partnership."',
               'In which of the positions marked [1], [2], [3], and [4] does the following sentence belong? "This is a first for the company since all previous limited designer edition lines were simply a one-time partnership."'),
         en='The preceding sentence mentions talks about future collaborations; “This is a first” refers to those potential repeat partnerships.',
         ko='앞 문장은 향후 추가 협업에 대한 논의를 언급하며, “This is a first”는 그처럼 다시 협업할 가능성을 가리킵니다.')
revision(N02, 7, 167, 'On Sunday',
         stem=('When most likely is the construction NOT being performed?', 'On which day does the business open in the morning?'),
         evidence=('9:00AM- 6:00PM',),
         en='The schedule lists a 9 A.M. opening on Sunday. It does not establish whether construction runs all day on Sunday.',
         ko='일정표에는 일요일 오전 9시 개점이 표시되어 있습니다. 일요일에 공사를 하루 종일 하지 않는지는 알 수 없습니다.')
revision(N02, 7, 177, 'She will partially back for her purchase.',
         stem=('What is implied about Ms. Fleck?', 'When did Ms. Fleck receive her order?'),
         options=['August 11', 'August 14', 'August 24', 'August 25'], correct='August 24',
         evidence=('Date: August 25', 'received my order from Taylor Fabrics yesterday'),
         en='Her email is dated August 25 and says the order arrived yesterday, so it arrived on August 24. The original guarantee has an unreadable deadline.',
         ko='이메일은 8월 25일에 작성되었고 주문품을 어제 받았다고 하므로 도착일은 8월 24일입니다. 원래 배송 보장 기한은 판독하기 어렵습니다.')
revision(N02, 7, 190, 'He will post a sign.',
         replace={'He will post a sign.': 'He proposes posting a sign.'}, evidence=('I could post a sign',),
         en='He offers to post a sign if the instructor agrees; he has not yet said that it will definitely be posted.',
         ko='그는 강사가 동의하면 안내문을 게시하겠다고 제안할 뿐, 이미 게시가 확정된 것은 아닙니다.')
revision(N02, 7, 194, 'There will be only one group.',
         replace={'There will be only one group.': 'If no more advanced riders sign up, there will likely be one group.'},
         evidence=('If there are not enough for two tours',),
         en='Only one listed rider is advanced. The sheet says riders should stay together if too few advanced riders sign up; the final sign-up count is not known.',
         ko='현재 명단에는 상급자가 한 명뿐입니다. 상급자가 충분하지 않으면 함께 타자고 하지만 최종 신청 인원은 아직 알 수 없습니다.')
revision(N02, 7, 195, 'She will stay with the group to participate in group activities.',
         replace={'She will stay with the group to participate in group activities.': 'If too few advanced riders sign up, she will likely stay with the group.'},
         evidence=('If there are not enough for two tours', 'Barbara Blaster'),
         en='Barbara is the only advanced rider listed. The plan is to stay together if there are not enough advanced riders, but more people may still sign up.',
         ko='명단에서 바버라는 유일한 상급자입니다. 상급자가 충분하지 않으면 함께 이동할 계획이지만 추가 신청이 있을 수도 있습니다.')
revision(N02, 7, 198, 'She has a Four Seasons Apprarel Outlet membership.',
         replace={'She has a Four Seasons Apprarel Outlet membership.': 'She asked to exchange a sweater for a different size.'},
         evidence=('medium-sized', 'small-sized'),
         en='She ordered a medium sweater, received a small one, and requested an exchange. A tracking number alone does not prove membership is exclusive to members.',
         ko='그녀는 미디엄 스웨터를 주문했으나 스몰을 받아 교환을 요청했습니다. 추적 번호만으로 회원인지 단정할 수는 없습니다.')
revision(N04, 7, 149, 'She currently operating automobile.',
         replace={'She currently operating automobile.': 'She is currently driving a car.'},
         evidence=('Drive carefully', 'Yep, I am'),
         en='After being told to drive carefully, she replies that she is doing so.',
         ko='운전 조심하라는 말에 그녀는 그렇게 하고 있다고 답합니다.')
revision(N04, 7, 156, 'Several have adopted.',
         replace={'Several have adopted.': 'Several have been adopted.'}, evidence=('have been adopted',),
         en='The article says more than ten dogs and fifteen cats have been adopted.',
         ko='기사에 따르면 개 열 마리와 고양이 열다섯 마리 이상이 입양되었습니다.')
revision(N04, 7, 188, 'Visit patients in critical condition',
         replace={'Visit patients in critical condition': 'Apply to be a patient’s pen pal'},
         evidence=('adult volunteers', 'encourages adults of all types'),
         en='Chambers encourages adults to apply to the pen-pal program. He hopes it will lead to visits, but does not specifically invite people to visit in this passage.',
         ko='체임버스는 성인들이 환자와 편지를 주고받는 자원봉사에 지원하도록 권합니다. 방문이 늘어나기를 바라지만 방문을 직접 신청하라고 하지는 않습니다.')
revision(N05, 7, 176, 'A decline in profitability',
         replace={'A decline in profitability': 'Low sales and disappointing performance'},
         evidence=('low sales and disappointing performance',),
         en='The article reports low sales and disappointing performance; it does not state the company’s profit figures.',
         ko='기사에는 매출 부진과 실망스러운 실적이 언급되지만 이익 수치는 제시되지 않습니다.')
revision(N05, 7, 189, 'Suzie lost her wallet on June 2 but her card was used at an ATM machine on June 3.',
         replace={'Suzie lost her wallet on June 2 but her card was used at an ATM machine on June 3.':
                  'Suzie lost her debit card on June 2, but it was used at an ATM on June 3.'},
         evidence=('lost my debit card on June 2', 'a day after you say that you lost your card'),
         en='Suzie reports losing her debit card, not her wallet. The bank notes the ATM transaction the following day.',
         ko='수지는 지갑이 아니라 직불카드를 분실했다고 말합니다. 은행 직원은 다음 날 ATM 거래가 발생한 점을 언급합니다.')
revision(N05, 7, 195, 'Because the housekeeper will be there to let him in',
         accepted=['Because the housekeeper will be there to let him in', 'Because that is the time the technician is available'],
         evidence=('available Monday, Wednesday, and Thursday', 'housekeeper who comes to clean on Monday and Friday'),
         en='Monday satisfies both conditions: the technician is available and the housekeeper can provide access. Both choices give valid reasons.',
         ko='월요일에는 기술자가 방문할 수 있고 가사도우미가 문을 열어 줄 수도 있습니다. 두 선택지 모두 타당한 이유입니다.')
revision(N08, 7, 152, 'At a literary event',
         stem=('What should be included in the report?', 'Where will the first copies of Mr. Tepper’s latest book be available?'),
         evidence=('first editions will be made available in a prize drawing at the New York Book Fair',),
         en='The first editions will be offered in a drawing at the New York Book Fair, a literary event.',
         ko='초판은 문학 행사인 뉴욕 북 페어에서 추첨을 통해 제공됩니다.')
revision(N08, 7, 163, "He'll decline this time.",
         accepted=["He'll decline this time.", "He can't make it."],
         evidence=("I'm going to take a pass this year",),
         en='“Take a pass” means he will skip the party. Both declining and being unable to make it can convey that he will not attend.',
         ko='“Take a pass”는 이번 행사에 참석하지 않겠다는 뜻입니다. 거절한다는 답과 참석하지 못한다는 답이 모두 통할 수 있습니다.')
revision(N08, 7, 179, 'It helped increase fan club membership.',
         replace={'It helped increase fan club membership.': 'It generated publicity for Ms. Lee’s book.'},
         evidence=('helped generate considerable publicity for your book',),
         en='Sanders says the article publicized the book. She separately reports a rise in fan-club membership but does not attribute it directly to the article.',
         ko='샌더스는 기사가 책을 널리 알리는 데 도움이 되었다고 말합니다. 팬클럽 회원 증가도 언급하지만 그 원인을 기사라고 직접 말하지는 않습니다.')
revision(N08, 7, 180, 'It will contain an article on desserts.',
         replace={'It will contain an article on desserts.': 'It may include more dessert recipes.'},
         evidence=('more recipes for', 'good idea to meet their needs'),
         en='Members request more recipes for cakes, cookies and candies, and Sanders suggests meeting that request. The contents are not yet confirmed.',
         ko='회원들이 케이크, 쿠키, 사탕 요리법을 더 요청했고 샌더스는 이를 반영하자고 제안합니다. 내용이 확정된 것은 아닙니다.')
revision(N08, 7, 184, 'To confirm a reservation',
         replace={'To confirm a reservation': 'To request a reservation'},
         evidence=('would like to reserve your conference space',),
         en='Rose requests a weekend reservation; the venue has not yet confirmed availability.',
         ko='로즈는 주말 예약을 요청합니다. 행사장이 이용 가능 여부를 아직 확정하지는 않았습니다.')
revision(N08, 7, 188, 'main office', accepted=['main office', 'base'],
         evidence=('headquarters downtown',),
         en='A company’s headquarters can be described as its main office or its base. Both are reasonable synonyms here.',
         ko='회사의 “headquarters”는 본사 또는 거점이라는 뜻이므로 “main office”와 “base” 모두 이 문맥에 맞습니다.')
revision(N09, 7, 154, 'Benjamin Palmer',
         stem=('Who is leaving the company?', 'Who is being replaced as project manager?'),
         evidence=('will replace Benjamin Palmer',),
         en='Bob Denkle will replace Benjamin Palmer. The passage says Palmer is moving to another position, not that he is leaving the company.',
         ko='밥 덴클이 벤저민 파머를 대신합니다. 지문은 파머가 다른 직책으로 이동한다고만 말하며 퇴사한다고 하지는 않습니다.')
revision(N09, 7, 173, 'It has existed for many decades.',
         replace={'It has existed for many decades.': 'It operates in the garment business.'},
         evidence=('garment business',),
         en='The speaker describes Trout & Lee as a successful company in the garment business. Its age is not specified.',
         ko='화자는 Trout & Lee를 성공적인 의류 업계 회사로 설명합니다. 회사가 몇 년 되었는지는 밝히지 않습니다.')
revision(N09, 7, 174, 'His position in the company',
         replace={'When he started working for the company': 'His age when he joined the company',
                  'His position in the company': 'His job title in the company'},
         evidence=('young man of thirty',),
         en='The speaker says Hernandez was thirty when he joined, but does not state his job title.',
         ko='화자는 에르난데스가 입사할 때 서른 살이었다고 말하지만 그의 직함은 밝히지 않습니다.')
revision(N09, 7, 176, 'They have included a complementary item with it.',
         replace={'They have included a complementary item with it.': 'They have included a complimentary item with it.'},
         evidence=('free pair of socks',),
         en='The store included a free pair of socks; “complimentary” means provided free of charge.',
         ko='매장은 무료 양말 한 켤레를 넣었습니다. “Complimentary”는 무료로 제공된다는 뜻입니다.')
revision(N09, 7, 178, 'To complain of a missing item',
         replace={'To complain of a missing item': 'To report receiving the wrong model of camping stove'},
         evidence=('ordered an Avalanche camping stove', 'received a MT Elite stove'),
         en='She ordered an Avalanche stove but received a different model; the complaint is about the wrong item, not an entirely missing delivery.',
         ko='그녀는 Avalanche 스토브를 주문했지만 다른 모델을 받았습니다. 배송품이 아예 빠진 것이 아니라 잘못된 제품이 온 것입니다.')
revision(N09, 7, 185, 'Between May 1 and May 7',
         stem=('When is the meeting scheduled to take place?', 'When is the promotional ticket price offered?'),
         evidence=('Starting on May 1', 'half price during the first week'),
         en='The new routes start May 1 and the discount lasts for the first week. The meeting date itself is not stated.',
         ko='새 노선은 5월 1일에 시작하고 할인은 첫 주 동안 적용됩니다. 회의 날짜 자체는 명시되지 않았습니다.')
revision(N09, 7, 193, '2,500 yards',
         stem=('According to the purchase order form, how much XP1 00 hosing is Jose Ramos returning?',
               'According to the purchase order form, how much XP1000 hosing is requested?'),
         evidence=('XP1000', '2,500 yards'),
         en='The form lists 2,500 yards of XP1000 requested. It does not establish the length of the old XP100 hose being returned.',
         ko='주문서에는 XP1000 호스 2,500야드가 요청되어 있습니다. 반품할 기존 XP100 호스의 길이는 명시되지 않았습니다.')
revision(N09, 7, 195, 'CFO', correct='Customer service',
         evidence=('received your report of a defective hose', 'offer you is an exchange'),
         en='Jenkins handles a product complaint and offers an exchange, making customer service the best-supported role. Nothing identifies her as CFO.',
         ko='젠킨스는 제품 불만을 처리하고 교환을 제안하므로 고객 서비스 담당자일 가능성이 가장 높습니다. CFO라는 근거는 없습니다.')
revision(N09, 7, 199, "He can hire everything that Robert's Parties recommends.",
         stem=("What is indicated about Leroy Jenkins' budget?", 'What budget does Mr. Jenkins give for the party, excluding alcohol?'),
         options=['$15 per person', '$25 per person', '$25 total', '$100 per person'], correct='$25 per person',
         evidence=('afford $25 per person', 'not including alcohol'),
         en='He states a budget of $25 per person excluding alcohol. The staffing duration is not given, so the total cost cannot be determined.',
         ko='그는 술값을 제외하고 1인당 25달러를 쓸 수 있다고 말합니다. 직원 근무 시간이 없어 총비용은 계산할 수 없습니다.')
revision(N10, 7, 150, 'He wants to be included in the group.',
         replace={'He wants to be included in the group.': 'He agrees to see the comedy.'},
         evidence=("I do love Ruffle Yellow Beard. I'm in",),
         en='Jason says he likes the comedy’s performer and agrees to the group’s movie choice.',
         ko='제이슨은 코미디 출연자를 좋아한다며 일행의 영화 선택에 동의합니다.')
revision(N10, 7, 152, 'Facts about ancient Egypt',
         replace={'Facts about ancient Egypt': 'Information about Mr. Price’s recent research'},
         evidence=("information concerning Mr. Price's most recent research",),
         en='The notice explicitly says the library website has information about Mr. Price’s recent research.',
         ko='안내문은 도서관 웹사이트에서 프라이스의 최근 연구 정보를 볼 수 있다고 명시합니다.')
revision(N10, 7, 156, 'They dislike Americans coming to shop.',
         replace={'They dislike Americans coming to shop.': 'They are frustrated by large crowds at their local store.'},
         evidence=('resentful of the large crowds',),
         en='The article says residents resent the crowds; it does not say they dislike shoppers because they are American.',
         ko='기사는 주민들이 혼잡한 인파에 불만을 품는다고 말할 뿐, 미국인이라는 이유로 쇼핑객을 싫어한다고 하지는 않습니다.')
revision(N10, 7, 161, "People don't know about it yet.",
         replace={"People don't know about it yet.": 'It is a new brand of beer.'}, evidence=('our new brand of beer',),
         en='Susan calls Winner’s Ale their new brand of beer. The dialogue does not establish how many people already know it.',
         ko='수전은 Winner’s Ale을 새 맥주 브랜드라고 부릅니다. 이미 알고 있는 사람이 얼마나 되는지는 알 수 없습니다.')
revision(N10, 7, 164, 'He likes to talk.',
         stem=('What is suggested about Jeff?', 'What does Jeff suggest doing at the event?'),
         options=["Observing a competitor's marketing", 'Reporting the group to corporate',
                  "Promoting Winner's Ale openly", 'Leaving before the event'],
         correct="Observing a competitor's marketing", evidence=("analyze our competitor's marketing strategy",),
         en='Jeff wants to watch the event and analyze the competitor’s marketing. The warning to keep quiet does not establish his personality.',
         ko='제프는 행사에 가서 경쟁사의 마케팅 전략을 분석하고 싶어 합니다. 조용히 하라는 말만으로 그의 성격을 판단할 수는 없습니다.')
revision(N10, 7, 167, 'The extra charge will be waived.',
         replace={'The extra charge will be waived.': 'The airline expects to remove the increase.'},
         evidence=('we expect to eliminate the fee increase',),
         en='The airline expects to eliminate the fee increase as fuel prices fall; this is an expectation, not a guarantee.',
         ko='항공사는 연료비가 내려가면 인상분을 없앨 것으로 기대하지만 이를 보장하지는 않습니다.')
revision(N10, 7, 168, 'She can speak a second language.',
         replace={'She can speak a second language.': 'She has agreed to give a conference presentation.'},
         evidence=('accepted our request to give a presentation',),
         en='The letter confirms that she accepted an invitation to present. It does not specify which languages she speaks.',
         ko='편지는 그녀가 발표 요청을 수락했다고 확인합니다. 어떤 언어를 구사하는지는 밝히지 않습니다.')
revision(N10, 7, 182, 'Floor care',
         stem=('What service was NOT provided to Randall Auto Body?', 'Which service is NOT mentioned on the invoice?'),
         replace={'Floor care': 'Hardwood floor polishing'}, evidence=('carpet deep clean',),
         en='The invoice lists windows, furniture and carpet cleaning, but not hardwood-floor polishing. Carpet cleaning is itself floor care.',
         ko='청구서에는 창문, 가구, 카펫 청소가 있지만 원목 바닥 광택 작업은 없습니다. 카펫 청소도 바닥 관리에 해당합니다.')
revision(N10, 7, 193, 'Emergent Solutions offers cheaper shipping costs than Express Corp.',
         replace={'Emergent Solutions offers cheaper shipping costs than Express Corp.': 'Emergent Solutions believes it can offer lower shipping rates.'},
         evidence=('I believe that we can beat their prices',),
         en='Alberts believes his company can beat the current carrier’s rates; an actual quote or agreement is not yet shown.',
         ko='알버츠는 기존 업체보다 저렴하게 제공할 수 있다고 생각하지만, 실제 견적이나 계약은 아직 제시되지 않았습니다.')
revision(N10, 7, 199, 'They are in a field Aaron is struggling in.',
         stem=('What is the problem with the sales leads James gave to Aaron?', 'Which division do the suggested sales leads belong to?'),
         options=['Technologies', 'Hospitality', 'Human Resources', 'Healthcare'], correct='Technologies',
         evidence=('Technologies',),
         en='The lead list places each contact in the Technologies division. Aaron’s sales difficulties do not show that the leads themselves are faulty.',
         ko='영업 후보 명단의 모든 연락처는 기술 부문에 속합니다. 에런의 영업 부진이 후보 정보 자체의 문제를 뜻하지는 않습니다.')
revision(N10, 7, 200, 'Owner',
         stem=('What is the job that Mr. Jones most likely has?', 'What decision is Mr. Jones considering?'),
         options=['Reducing staff if sales do not improve', 'Opening a beauty parlor',
                  'Canceling the performance reviews', 'Hiring more salespeople'],
         correct='Reducing staff if sales do not improve', evidence=('trim the staff if things',),
         en='James says Mr. Jones plans to reduce staff if results do not improve. His job title and ownership status are not given.',
         ko='제임스는 실적이 개선되지 않으면 존스가 인원을 줄이려 한다고 말합니다. 그의 직함이나 소유주 여부는 나오지 않습니다.')
revision(N20, 7, 162, 'A fashion company', accepted=['A fashion company', 'A clothing shop'],
         evidence=('dresses went', 'showroom'),
         en='The staff discuss dresses and a showroom. Both a fashion company and a clothing shop could fit; the passage does not distinguish them.',
         ko='직원들은 드레스와 쇼룸을 이야기합니다. 패션 회사와 의류 매장 모두 가능하며 지문만으로 둘을 구별할 수 없습니다.')
revision(N20, 7, 165, 'A boutique',
         stem=('What kind of business is Chantelle?', 'What items were sent to the wrong address?'),
         options=['Dresses', 'Coffee', 'Office chairs', 'Fabric samples'], correct='Dresses',
         evidence=('where those dresses went', 'wrong address'),
         en='The shipment sent to the wrong address contained dresses. Chantelle’s exact type of business is not stated.',
         ko='잘못된 주소로 배송된 물품은 드레스입니다. 샹텔의 정확한 업종은 명시되지 않았습니다.')
revision(N20, 7, 169, 'He supports a public organization.',
         replace={'He supports a public organization.': 'He donates to a community center.'},
         evidence=('continued donations', 'Tate Community Center'),
         en='He is thanked for continuing to donate to the community center. Its public or private ownership is not stated.',
         ko='그는 지역 커뮤니티 센터에 꾸준히 기부한 것에 대해 감사 인사를 받습니다. 센터의 공공·민간 소유 여부는 나오지 않습니다.')
revision(N20, 7, 172, 'To inform an employee about a mandatory exam',
         accepted=['To inform an employee about a mandatory exam', 'To discuss the changes made to the health insurance coverage'],
         evidence=('changes that have been made to your health insurance benefits', 'must now undergo a basic medical check-up'),
         en='The letter announces a mandatory check-up as part of changes to employees’ health benefits. Both options describe its purpose.',
         ko='이 편지는 직원 건강보험 혜택 변경의 일부로 필수 건강검진을 안내합니다. 두 선택지 모두 편지의 목적을 설명합니다.')
revision(N20, 7, 174, 'Responsible for', replace={'Responsible for': 'At risk of'},
         evidence=('subject to a fine',),
         en='Here “subject to a fine” means liable to or at risk of being fined.',
         ko='여기서 “subject to a fine”은 벌금을 부과받을 수 있다는 뜻입니다.')
revision(N20, 7, 182, 'He will enter a competition with his son.',
         replace={'He will enter a competition with his son.': 'He hopes to enter a model-building contest with his son.'},
         evidence=('planning to submit', 'local model building contest'),
         en='He and his son planned to submit the model, but missing parts mean their participation is not guaranteed.',
         ko='그와 아들은 모형을 대회에 출품할 계획이었지만 부품이 빠져 실제 참가가 보장된 것은 아닙니다.')
revision(N20, 7, 183, 'Be consulting a user manual',
         replace={'Be consulting a user manual': 'By consulting a user manual'}, evidence=('instruction manual',),
         en='Both posters noticed missing parts by referring to the instruction manual.',
         ko='두 게시자 모두 설명서를 확인하여 부품이 빠진 것을 알았습니다.')
revision(N21, 7, 188, 'Contact information', accepted=['Contact information', 'Driving directions'],
         evidence=('added some helpful information to the end', 'exit 21 on Highway 5', 'Reservations can now be made online'),
         en='The end of the advertisement contains both directions and reservation contact information. The email does not identify which helpful information was newly added.',
         ko='광고 끝에는 찾아오는 길과 예약 연락처가 모두 있습니다. 이메일은 어떤 유용한 정보가 새로 추가되었는지 구체적으로 밝히지 않습니다.')
revision(N21, 7, 189, 'He wants to combine all of the discounts together and apply it to one purchase.',
         accepted=['He wants to combine all of the discounts together and apply it to one purchase.',
                   'He wants to buy his son a putter with his.'],
         evidence=('pooled together for one large purchase', 'buy him a new putter'),
         en='He wants to pool the coupons to buy his son a putter; that also entails using his own coupon toward the putter.',
         ko='그는 쿠폰을 합쳐 아들에게 퍼터를 사 주고 싶어 합니다. 이 계획에는 자신의 쿠폰도 퍼터 구매에 쓰는 것이 포함됩니다.')
revision(N21, 7, 200, 'Melisa Perkins included her receipt of sale from an authorized Red Rock Leather Goods store.',
         accepted=['Melisa Perkins included her receipt of sale from an authorized Red Rock Leather Goods store.',
                   'It was a manufacturing defect.'],
         evidence=('sales receipt is necessary', 'concluded that it falls within our warranty'),
         en='The company approves coverage for defects in craftsmanship and requires a receipt. Both the defect and receipt are supported by the approval and policy.',
         ko='회사는 제작 결함을 보증하며 영수증을 요구합니다. 보증 승인과 규정을 함께 보면 결함과 영수증 제출을 모두 추론할 수 있습니다.')
