describe('Test with mocked element', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    const section1 = document.createElement('div');
    section1.classList.add('section');
    const section2 = document.createElement('div');
    section2.classList.add('section');
    element.appendChild(section1);
    element.appendChild(section2);
  });

  it('should not throw an error when querying sections', () => {
    const sections = [...element.querySelectorAll('div.section')];

    expect(sections.length).toBe(2);
    expect(sections[0].classList.contains('section')).toBe(true);
    expect(sections[1].classList.contains('section')).toBe(true);
  });

  it('should add a new section and retrieve all sections', () => {
    const newSection = document.createElement('div');
    newSection.classList.add('section');
    element.appendChild(newSection);

    const sections = [...element.querySelectorAll('div.section')];
    expect(sections.length).toBe(3);
    expect(sections[2].classList.contains('section')).toBe(true);
  });

  it('should handle an element with no sections gracefully', () => {
    const emptyElement = document.createElement('div');
    const sections = [...emptyElement.querySelectorAll('div.section')];
    expect(sections.length).toBe(0);
  });

  it('should verify the class name of the first section', () => {
    const firstSection = element.querySelector('div.section');

    expect(firstSection).toBeTruthy();
    expect(firstSection.classList.contains('section')).toBe(true);
  });

  it('should remove a section and verify the remaining sections', () => {
    const firstSection = element.querySelector('div.section');
    firstSection.remove();

    const sections = [...element.querySelectorAll('div.section')];

    expect(sections.length).toBe(1);
    expect(sections[0].classList.contains('section')).toBe(true);
  });

  it('should verify that a section contains specific text content', () => {
    const firstSection = element.querySelector('div.section');
    firstSection.textContent = 'This is a test section';

    expect(firstSection.textContent).toBe('This is a test section');
  });

  it('should verify that sections have unique IDs', () => {
    const sections = [...element.querySelectorAll('div.section')];
    sections.forEach((section, index) => {
      section.id = `section-${index + 1}`;
    });

    expect(sections[0].id).toBe('section-1');
    expect(sections[1].id).toBe('section-2');
  });

  it('should toggle a class on a section and verify the state', () => {
    const firstSection = element.querySelector('div.section');
    firstSection.classList.toggle('active');

    expect(firstSection.classList.contains('active')).toBe(true);

    firstSection.classList.toggle('active');

    expect(firstSection.classList.contains('active')).toBe(false);
  });

  it('should verify that a section can be hidden and shown', () => {
    const firstSection = element.querySelector('div.section');
    firstSection.style.display = 'none';
    expect(firstSection.style.display).toBe('none');
    firstSection.style.display = 'block';
    expect(firstSection.style.display).toBe('block');
  });
});
